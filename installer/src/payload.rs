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
    Ok(Extracted { dir, exe, keep: false })
}

/// The installer's arguments: silent (`/S`), without the desktop shortcut if unwanted (`/NS`).
pub fn silent_args(desktop: bool) -> Vec<&'static str> {
    if desktop {
        vec!["/S"]
    } else {
        vec!["/S", "/NS"]
    }
}

/// Runs the installer invisibly and waits for it; its exit code (−1 if it gave none).
pub fn install_silently(exe: &Path, desktop: bool) -> io::Result<i32> {
    let status = Command::new(exe).args(silent_args(desktop)).status()?;
    Ok(status.code().unwrap_or(-1))
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
    fn the_desktop_shortcut_is_left_out_on_request() {
        assert_eq!(silent_args(true), ["/S"]);
        assert_eq!(silent_args(false), ["/S", "/NS"]);
    }
}
