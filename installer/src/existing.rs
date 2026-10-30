//! What is already on this PC: an installed Kayro (its version and folder, read from the uninstall
//! key the NSIS installer writes), whether it is running, and closing it softly (`--quit`).

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use windows::core::PCWSTR;
use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};

/// Where the NSIS installer records itself (`installMode: currentUser`, so under HKCU).
const UNINSTALL_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Kayro";
const EXE: &str = "Kayro.exe";

#[derive(Debug, Clone, PartialEq)]
pub struct Installed {
    pub version: String,
    pub dir: PathBuf,
}

impl Installed {
    pub fn exe(&self) -> PathBuf {
        self.dir.join(EXE)
    }
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(Some(0)).collect()
}

fn read_value(name: &str) -> Option<String> {
    let key = wide(UNINSTALL_KEY);
    let value = wide(name);
    let mut buf = [0u16; 1024];
    let mut bytes = u32::try_from(std::mem::size_of_val(&buf)).ok()?;
    // SAFETY: the strings and `buf` outlive the call; `bytes` is the buffer size in bytes.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            PCWSTR(key.as_ptr()),
            PCWSTR(value.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            Some(buf.as_mut_ptr().cast()),
            Some(&mut bytes),
        )
    };
    if status.0 != 0 {
        return None;
    }
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    Some(String::from_utf16_lossy(&buf[..len]))
}

/// The Kayro installed for this account, if any (the folder is written between quotes).
pub fn installed() -> Option<Installed> {
    let version = read_value("DisplayVersion")?;
    let dir = read_value("InstallLocation")?;
    let dir = dir.trim().trim_matches('"');
    (!dir.is_empty()).then(|| Installed { version, dir: PathBuf::from(dir) })
}

/// Whether a Kayro started from `exe` is running (another copy elsewhere does not matter here:
/// the installer only replaces this one).
pub fn running(exe: &Path) -> bool {
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet),
    );
    system
        .processes()
        .values()
        .any(|p| p.exe().is_some_and(|e| same_path(e, exe)))
}

fn same_path(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().eq_ignore_ascii_case(&b.to_string_lossy())
}

/// Asks the running Kayro to quit as with « Quitter » (never a kill), then waits for it (10 s).
/// Not running: nothing to start (an old Kayro without `--quit` would open instead).
pub fn close_softly(exe: &Path) -> bool {
    if !running(exe) {
        return true;
    }
    if Command::new(exe).arg("--quit").spawn().is_err() {
        return false;
    }
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        if !running(exe) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    !running(exe)
}

/// `a.b.c` compared number by number (a missing part counts as 0; a non-number as 0).
pub fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parts = |v: &str| -> Vec<u64> { v.split('.').map(|p| p.trim().parse().unwrap_or(0)).collect() };
    let (pa, pb) = (parts(a), parts(b));
    let n = pa.len().max(pb.len());
    (0..n)
        .map(|i| pa.get(i).unwrap_or(&0).cmp(pb.get(i).unwrap_or(&0)))
        .find(|o| o.is_ne())
        .unwrap_or(std::cmp::Ordering::Equal)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cmp::Ordering::*;

    #[test]
    fn versions_compare_number_by_number() {
        assert_eq!(compare_versions("0.16.0", "0.15.0"), Greater);
        assert_eq!(compare_versions("0.9.0", "0.10.0"), Less);
        assert_eq!(compare_versions("0.16", "0.16.0"), Equal);
        assert_eq!(compare_versions("1.0.0", "0.99.9"), Greater);
    }

    #[test]
    fn paths_match_whatever_the_case() {
        assert!(same_path(Path::new("C:\\Users\\A\\Kayro.exe"), Path::new("c:\\users\\a\\kayro.EXE")));
        assert!(!same_path(Path::new("C:\\A\\Kayro.exe"), Path::new("C:\\B\\Kayro.exe")));
    }
}
