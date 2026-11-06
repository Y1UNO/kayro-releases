//! The brain's seat beside the listening (listen.rs): started on a thread of its own, so that
//! the voice keeps listening (the classic way answers) while the server loads (≈ 5 s, ≈ 35 s the
//! very first time); looked at every few seconds; let go when not wanted (a game in front, turned
//! off, its files being removed) or once it stopped; tried again after a while.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};

use super::Brain;

/// A brain that would not start (or stopped) is tried again after this long.
pub const RETRY: Duration = Duration::from_secs(300);

type Starting = (mpsc::Receiver<Result<Brain, String>>, Arc<AtomicBool>);

#[derive(Default)]
pub struct Slot {
    ready: Option<Brain>,
    /// Loading on its thread: its answer comes here; the flag stops it early.
    starting: Option<Starting>,
    failed: Option<Instant>,
}

/// What a look at the loading found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Polled {
    Unchanged,
    Ready,
    Failed,
}

impl Slot {
    pub fn get(&self) -> Option<&Brain> {
        self.ready.as_ref()
    }

    /// Let go, now: a loading is stopped, a failure before is forgotten (tried again as soon as
    /// it is wanted).
    pub fn release(&mut self) {
        self.ready = None;
        if let Some((_, cancel)) = self.starting.take() {
            cancel.store(true, Ordering::SeqCst);
        }
        self.failed = None;
    }

    /// Wanted: one that stopped is noticed; none there, none loading, and the retry passed: it
    /// starts loading (`dir`: its files).
    pub fn want(&mut self, dir: PathBuf) {
        self.stopped();
        let waiting = self.failed.is_some_and(|t| t.elapsed() < RETRY);
        if self.ready.is_some() || self.starting.is_some() || waiting {
            return;
        }
        let (tx, rx) = mpsc::channel();
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = cancel.clone();
        let spawned = std::thread::Builder::new()
            .name("voice-brain".into())
            .spawn(move || {
                // Nobody waiting any more (let go meanwhile): the brain is dropped, its server
                // killed.
                let _ = tx.send(Brain::start_unless(&dir, &flag));
            });
        match spawned {
            Ok(_) => self.starting = Some((rx, cancel)),
            Err(e) => {
                tracing::warn!(error = %e, "voice: the brain's thread could not start");
                self.failed = Some(Instant::now());
            }
        }
    }

    /// A brain that stopped on its own (crashed): gone, tried again later. `true` when it just
    /// did.
    pub fn stopped(&mut self) -> bool {
        if self.ready.as_mut().is_some_and(|b| !b.running()) {
            tracing::warn!("voice: the brain stopped");
            self.ready = None;
            self.failed = Some(Instant::now());
            return true;
        }
        false
    }

    /// What the loading gave, if it ended.
    pub fn poll(&mut self) -> Polled {
        let Some((rx, _)) = self.starting.as_ref() else {
            return Polled::Unchanged;
        };
        let got = match rx.try_recv() {
            Ok(r) => r,
            Err(mpsc::TryRecvError::Empty) => return Polled::Unchanged,
            Err(mpsc::TryRecvError::Disconnected) => Err("its thread ended".into()),
        };
        self.starting = None;
        self.took(got)
    }

    /// Waits for a loading to end (the calibration's evaluation wants the brain if there is
    /// one, as the listening would have it).
    pub fn wait(&mut self) {
        if let Some((rx, _)) = self.starting.take() {
            let got = rx.recv().unwrap_or_else(|_| Err("its thread ended".into()));
            self.took(got);
        }
    }

    fn took(&mut self, got: Result<Brain, String>) -> Polled {
        match got {
            Ok(b) => {
                self.ready = Some(b);
                Polled::Ready
            }
            Err(e) => {
                tracing::warn!(error = %e, "voice: the brain did not start");
                self.failed = Some(Instant::now());
                Polled::Failed
            }
        }
    }

    /// Missing, nothing loading, and its retry due.
    pub fn due(&self) -> bool {
        self.ready.is_none()
            && self.starting.is_none()
            && self.failed.is_some_and(|t| t.elapsed() >= RETRY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_brain_fails_once_then_waits_for_its_retry() {
        let mut s = Slot::default();
        let dir = tempfile::tempdir().unwrap();
        s.want(dir.path().to_path_buf());
        s.wait();
        assert!(s.get().is_none() && !s.due() && s.failed.is_some());
        // Wanted again at once: nothing starts (the retry is not due).
        s.want(dir.path().to_path_buf());
        assert!(s.starting.is_none());
        // Let go: the failure is forgotten.
        s.release();
        assert!(s.failed.is_none() && s.poll() == Polled::Unchanged);
    }
}
