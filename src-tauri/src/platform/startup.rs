//! The registry traces Windows keeps for « start with Windows ».

use windows::core::{w, HSTRING};
use windows::Win32::System::Registry::{RegDeleteKeyValueW, HKEY_CURRENT_USER};

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
