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
    (!dir.is_empty()).then(|| Installed {
        version,
        dir: PathBuf::from(dir),
    })
}

/// Whether the installed Kayro (`exe`) is running. Matched by its place, `…\Kayro\Kayro.exe`, not
/// its full path: Windows may report another path for the same file (AppData redirected for a
/// packaged parent app). A copy elsewhere (a developer's build) does not count.
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
        .any(|p| p.exe().is_some_and(|e| same_place(e, exe)))
}

/// Same file name in a folder of the same name (`…\Kayro\Kayro.exe`), whatever the case.
fn same_place(a: &Path, b: &Path) -> bool {
    let tail = |p: &Path| -> Option<String> {
        let name = p.file_name()?.to_string_lossy().to_lowercase();
        let dir = p.parent()?.file_name()?.to_string_lossy().to_lowercase();
        Some(format!("{dir}\\{name}"))
    };
    matches!((tail(a), tail(b)), (Some(x), Some(y)) if x == y)
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

/// Kayro's data folder (`%APPDATA%/Kayro`), where it finds the installer's choices and journals.
pub fn data_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|d| PathBuf::from(d).join("Kayro"))
}

/// The choices Kayro applies at its next start (`%APPDATA%/Kayro/install-choices.json`).
/// `autostart`: Kayro opens on its home screen at login (step 19).
pub fn write_install_choices(update_auto: bool, autostart: bool) -> std::io::Result<()> {
    let dir = data_dir().ok_or(std::io::ErrorKind::NotFound)?;
    std::fs::create_dir_all(&dir)?;
    std::fs::write(
        dir.join("install-choices.json"),
        install_choices_json(update_auto, autostart),
    )
}

fn install_choices_json(update_auto: bool, autostart: bool) -> String {
    format!("{{\"updateAuto\":{update_auto},\"autostart\":{autostart}}}")
}

/// The user's desktop folder (where NSIS puts its shortcut), wherever Windows moved it.
pub fn desktop_dir() -> Option<PathBuf> {
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::UI::Shell::{FOLDERID_Desktop, SHGetKnownFolderPath, KF_FLAG_DEFAULT};
    // SAFETY: the returned string is read once, then freed with the COM allocator as required.
    unsafe {
        let path = SHGetKnownFolderPath(&FOLDERID_Desktop, KF_FLAG_DEFAULT, None).ok()?;
        let text = path.to_string().ok();
        CoTaskMemFree(Some(path.0 as *const _));
        text.map(PathBuf::from)
    }
}

/// `a.b.c` compared number by number (a missing part counts as 0; a non-number as 0).
pub fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parts = |v: &str| -> Vec<u64> {
        v.split('.')
            .map(|p| p.trim().parse().unwrap_or(0))
            .collect()
    };
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

    /// Manual probe: `cargo test -p kayro-setup -- --ignored --nocapture probe` with Kayro open.
    #[test]
    #[ignore]
    fn probe_running() {
        let i = installed();
        println!("installed: {i:?}");
        let mut system = System::new();
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet),
        );
        for p in system
            .processes()
            .values()
            .filter(|p| p.name().to_string_lossy().contains("Kayro"))
        {
            println!("{:?} {:?}", p.name(), p.exe());
        }
        println!("running: {:?}", i.map(|i| running(&i.exe())));
    }

    #[test]
    fn the_install_choices_are_the_json_kayro_reads() {
        assert_eq!(
            install_choices_json(true, false),
            r#"{"updateAuto":true,"autostart":false}"#
        );
        assert_eq!(
            install_choices_json(false, true),
            r#"{"updateAuto":false,"autostart":true}"#
        );
    }

    #[test]
    fn the_installed_kayro_is_known_by_its_place() {
        let installed = Path::new("C:\\Users\\A\\AppData\\Local\\Kayro\\Kayro.exe");
        // Redirected by Windows for a packaged parent app: the same file.
        let redirected = Path::new(
            "C:\\Users\\A\\AppData\\Local\\Packages\\X\\LocalCache\\Local\\kayro\\KAYRO.exe",
        );
        assert!(same_place(redirected, installed));
        // A developer's build elsewhere does not count.
        assert!(!same_place(
            Path::new("C:\\HUB\\target\\release\\Kayro.exe"),
            installed
        ));
    }
}
