//! The NSIS installer carried inside this exe (copied by build.rs from `KAYRO_PAYLOAD`): written to
//! a temporary folder, then run invisibly (`/S`) behind the styled window, or with its own window
//! when this one cannot help (no WebView2, an error).

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

static PAYLOAD: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/payload.bin"));

/// False in a build made without `KAYRO_PAYLOAD` (tests, clippy): nothing to install.
pub fn present() -> bool {
    !PAYLOAD.is_empty()
}

/// The installer written to a temporary folder, removed when dropped (unless kept).
pub struct Extracted {
    dir: PathBuf,
    pub exe: PathBuf,
    keep: bool,
}

impl Extracted {
    /// Leaves the file for a program that outlives this one (the classic installer).
    pub fn keep(mut self) -> PathBuf {
        self.keep = true;
        self.exe.clone()
    }
}

impl Drop for Extracted {
    fn drop(&mut self) {
        if !self.keep {
            let _ = fs::remove_dir_all(&self.dir);
        }
    }
}

pub fn extract(version: &str) -> io::Result<Extracted> {
    let dir = std::env::temp_dir().join(format!("kayro-setup-{version}-{}", std::process::id()));
    fs::create_dir_all(&dir)?;
    let exe = dir.join(format!("Kayro_{version}_x64-setup.exe"));
    fs::write(&exe, PAYLOAD)?;
    Ok(Extracted {
        dir,
        exe,
        keep: false,
    })
}

/// The desktop shortcut NSIS makes in silent mode.
const SHORTCUT: &str = "Kayro.lnk";

/// Runs the installer invisibly (`/S`) and waits for it; its exit code (−1 if it gave none).
/// Never `/NS`: it leaves out the Start menu shortcut too. Without the desktop shortcut, the one
/// NSIS made is removed afterwards, or the one that was there before is put back as it was.
pub fn install_silently(exe: &Path, desktop: bool, desktop_dir: Option<&Path>) -> io::Result<i32> {
    let lnk = desktop_dir.map(|d| d.join(SHORTCUT));
    let before = lnk.as_ref().and_then(|l| fs::read(l).ok());
    let status = Command::new(exe).arg("/S").status()?;
    if let (false, Some(lnk)) = (desktop, &lnk) {
        put_back(lnk, before);
    }
    Ok(status.code().unwrap_or(-1))
}

/// The shortcut as it was before the install: its old bytes, or none.
fn put_back(lnk: &Path, before: Option<Vec<u8>>) {
    let _ = match before {
        Some(bytes) => fs::write(lnk, bytes),
        None => fs::remove_file(lnk),
    };
}

/// Starts the classic installer (its own window) and lets it run on its own.
pub fn run_classic(version: &str) -> bool {
    if !present() {
        return false;
    }
    match extract(version) {
        Ok(x) => Command::new(x.keep()).spawn().is_ok(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unwanted_desktop_shortcut_is_removed_or_put_back() {
        let dir = std::env::temp_dir().join(format!("kayro-setup-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let lnk = dir.join(SHORTCUT);
        // Made by the install, none before: removed.
        fs::write(&lnk, b"nsis").unwrap();
        put_back(&lnk, None);
        assert!(!lnk.exists());
        // The user's own one before: put back as it was.
        fs::write(&lnk, b"nsis").unwrap();
        put_back(&lnk, Some(b"mine".to_vec()));
        assert_eq!(fs::read(&lnk).unwrap(), b"mine");
        fs::remove_dir_all(&dir).unwrap();
    }
}
