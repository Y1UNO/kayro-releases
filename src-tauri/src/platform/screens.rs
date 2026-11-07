//! The screen a window is on: its refresh rate, for the « Auto » quality (step 24).
//! (Step 21 also numbered the screens to move windows by voice; removed with the voice, 2026-11-07.)

use windows::core::PCWSTR;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    EnumDisplaySettingsW, GetMonitorInfoW, MonitorFromWindow, DEVMODEW, ENUM_CURRENT_SETTINGS,
    MONITORINFO, MONITORINFOEXW, MONITOR_DEFAULTTONEAREST,
};

/// Refresh rate (Hz) of the screen holding most of the window (« Auto » quality, step 24: a frame
/// is late against this, not against what the app happens to draw). `None` when Windows does not
/// say (0 or 1 = « the hardware's default »).
pub fn refresh_hz(raw_hwnd: isize) -> Option<u32> {
    let hwnd = HWND(raw_hwnd as *mut _);
    let mut info = MONITORINFOEXW::default();
    info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;
    let mut mode = DEVMODEW {
        dmSize: size_of::<DEVMODEW>() as u16,
        ..Default::default()
    };
    // SAFETY: read-only queries; `info` is sized as an extended monitor info, `szDevice` is the
    // NUL-terminated device name it just filled, `mode` carries its own size.
    unsafe {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if !GetMonitorInfoW(monitor, &mut info as *mut _ as *mut MONITORINFO).as_bool() {
            return None;
        }
        let name = PCWSTR(info.szDevice.as_ptr());
        if !EnumDisplaySettingsW(name, ENUM_CURRENT_SETTINGS, &mut mode).as_bool() {
            return None;
        }
    }
    (mode.dmDisplayFrequency > 1).then_some(mode.dmDisplayFrequency)
}
