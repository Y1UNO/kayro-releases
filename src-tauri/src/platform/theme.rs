//! Windows light/dark preference, read from the registry.

use windows::core::{w, PCWSTR};
use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};

fn read_dword(name: PCWSTR) -> Option<u32> {
    let mut value = 0u32;
    let mut bytes = std::mem::size_of::<u32>() as u32;
    // SAFETY: `value` and `bytes` outlive the call; `bytes` is the buffer size in bytes.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"),
            name,
            RRF_RT_REG_DWORD,
            None,
            Some((&mut value as *mut u32).cast()),
            Some(&mut bytes),
        )
    };
    (status.0 == 0).then_some(value)
}

/// True when the taskbar (and so the notification area) is light. The taskbar follows
/// `SystemUsesLightTheme`, which can differ from `AppsUseLightTheme`; the latter is the fallback.
/// Dark when neither value exists.
pub fn taskbar_is_light() -> bool {
    read_dword(w!("SystemUsesLightTheme"))
        .or_else(|| read_dword(w!("AppsUseLightTheme")))
        .is_some_and(|v| v != 0)
}
