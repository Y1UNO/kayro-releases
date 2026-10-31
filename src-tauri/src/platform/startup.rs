//! The registry traces Windows keeps for « start with Windows ».

use windows::core::{w, HSTRING};
use windows::Win32::System::Registry::{
    RegDeleteKeyValueW, RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ,
};

/// The command Windows runs at login for `name` (`Run` key), if there is one.
pub fn run_command(name: &str) -> Option<String> {
    let mut buf = [0u16; 1024];
    let mut bytes = u32::try_from(std::mem::size_of_val(&buf)).ok()?;
    // SAFETY: `buf` and `bytes` outlive the call; `bytes` is the buffer size in bytes.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run"),
            &HSTRING::from(name),
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

/// Removes `name` from the list Windows keeps of which login programs the user switched on or
/// off (`StartupApproved\Run`). The autostart plugin leaves a « disabled » mark there when
/// turned off; removing it brings the registry back to what it was before the first enable.
/// Missing value = nothing to do.
pub fn forget_startup_approval(name: &str) {
    // SAFETY: both strings outlive the call; the function only deletes one value of the
    // current user's hive.
    let status = unsafe {
        RegDeleteKeyValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run"),
            &HSTRING::from(name),
        )
    };
    // 0 = deleted, 2 = there was no such value.
    if status.0 != 0 && status.0 != 2 {
        tracing::warn!(code = status.0, "could not clean the startup approval mark");
    }
}
