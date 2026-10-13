use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{PoisonError, RwLock, RwLockReadGuard, TryLockError};
use std::time::{Duration, Instant};

/// The writes in progress, and the closing that stops new ones when Kayro quits (review A12): a
/// quit waits for the writes already started; a write asked for afterwards does not start (the
/// file keeps its content). Nobody ever waits for ever: the main thread may still ask for one.
pub struct WriteGate {
    running: RwLock<()>,
    closed: AtomicBool,
}

/// Every `write_atomic` of the app goes through this gate.
pub static WRITES: WriteGate = WriteGate::new();

impl WriteGate {
    pub const fn new() -> Self {
        Self {
            running: RwLock::new(()),
            closed: AtomicBool::new(false),
        }
    }

    /// Held for the length of one write (many writes may run at once); `None` once closed.
    pub fn writing(&self) -> Option<RwLockReadGuard<'_, ()>> {
        let held = self.running.read().unwrap_or_else(PoisonError::into_inner);
        (!self.closed.load(Ordering::SeqCst)).then_some(held)
    }

    /// Closes the gate, then waits up to `limit` for the writes already started. False when one
    /// was still running at the limit (its target stays whole all the same: the write is atomic).
    pub fn close(&self, limit: Duration) -> bool {
        self.closed.store(true, Ordering::SeqCst);
        let deadline = Instant::now() + limit;
        loop {
            match self.running.try_write() {
                Ok(_) | Err(TryLockError::Poisoned(_)) => return true,
                Err(TryLockError::WouldBlock) if Instant::now() >= deadline => return false,
                Err(TryLockError::WouldBlock) => std::thread::sleep(Duration::from_millis(5)),
            }
        }
    }
}

impl Default for WriteGate {
    fn default() -> Self {
        Self::new()
    }
}

/// `<file>.tmp`, next to the target so the final rename stays on one volume.
pub fn tmp_path(path: &Path) -> PathBuf {
    sibling(path, ".tmp")
}

/// `<file><suffix>` in the same folder (`apps.json` + `.bak` → `apps.json.bak`).
pub fn sibling(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(suffix);
    PathBuf::from(name)
}

/// First half of an atomic write: the new content is fully written and flushed to a
/// temporary file. A crash here leaves the target untouched.
pub fn stage(path: &Path, bytes: &[u8]) -> io::Result<PathBuf> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = tmp_path(path);
    let mut file = File::create(&tmp)?;
    let written = file.write_all(bytes).and_then(|()| file.sync_all());
    if let Err(e) = written {
        drop(file);
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(tmp)
}

/// Second half: the rename that swaps the new content in (replaces an existing file).
pub fn commit(tmp: &Path, path: &Path) -> io::Result<()> {
    fs::rename(tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(tmp);
    })
}

/// Writes `bytes` to `path` so that readers see either the old or the new content, never a mix.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let Some(_writing) = WRITES.writing() else {
        return Err(io::Error::other("Kayro is quitting: write not started"));
    };
    let tmp = stage(path, bytes)?;
    commit(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_replaces() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.json");
        write_atomic(&p, b"one").unwrap();
        write_atomic(&p, b"two").unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"two");
        assert!(!tmp_path(&p).exists());
    }

    #[test]
    fn interrupted_write_keeps_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.json");
        write_atomic(&p, b"old").unwrap();
        // Simulated crash: content staged, rename never happens.
        let tmp = stage(&p, b"new-but-never-committed").unwrap();
        assert!(tmp.exists());
        assert_eq!(fs::read(&p).unwrap(), b"old");
    }

    #[test]
    fn closing_waits_for_the_write_in_progress_then_starts_no_other() {
        use std::sync::{mpsc, Arc};
        use std::thread;

        let gate = Arc::new(WriteGate::new());
        // A slow write is running: closing waits for its end.
        let (started, wait_start) = mpsc::channel();
        let slow = {
            let gate = gate.clone();
            thread::spawn(move || {
                let _w = gate.writing().expect("open");
                started.send(()).unwrap();
                thread::sleep(Duration::from_millis(150));
            })
        };
        wait_start.recv().unwrap();
        let t0 = Instant::now();
        assert!(gate.close(Duration::from_secs(2)));
        assert!(t0.elapsed() >= Duration::from_millis(100));
        slow.join().unwrap();
        // Closed: a write asked for now does not start, and nothing waits.
        assert!(gate.writing().is_none());
    }

    #[test]
    fn closing_gives_up_at_its_limit_while_a_write_still_runs() {
        let gate = WriteGate::new();
        let _w = gate.writing();
        let t0 = Instant::now();
        assert!(!gate.close(Duration::from_millis(40)));
        assert!(t0.elapsed() >= Duration::from_millis(40));
    }

    #[test]
    fn failed_rename_keeps_the_original_and_cleans_up() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.json");
        fs::create_dir(&p).unwrap(); // a directory cannot be replaced by a file
        assert!(write_atomic(&p, b"x").is_err());
        assert!(p.is_dir());
        assert!(!tmp_path(&p).exists());
    }
}
