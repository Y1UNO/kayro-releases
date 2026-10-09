use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

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
    fn failed_rename_keeps_the_original_and_cleans_up() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.json");
        fs::create_dir(&p).unwrap(); // a directory cannot be replaced by a file
        assert!(write_atomic(&p, b"x").is_err());
        assert!(p.is_dir());
        assert!(!tmp_path(&p).exists());
    }
}
