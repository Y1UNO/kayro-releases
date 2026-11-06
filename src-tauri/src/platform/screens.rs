//! The PC's screens, numbered as Windows numbers them (Paramètres › Affichage: 1, 2…), and an
//! app's window put on one (step 21: « mets Discord sur mon premier écran »).

use windows::core::BOOL;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::Graphics::Gdi::{
    EnumDisplayMonitors, EnumDisplaySettingsW, GetMonitorInfoW, MonitorFromWindow, DEVMODEW,
    ENUM_CURRENT_SETTINGS, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowRect, IsZoomed, SetWindowPos, ShowWindow, MONITORINFOF_PRIMARY, SWP_NOACTIVATE,
    SWP_NOZORDER, SW_MAXIMIZE, SW_RESTORE,
};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Screen {
    /// Windows' number (the « 2 » of `\\.\DISPLAY2`).
    pub number: u32,
    /// The part windows go in (without the taskbar).
    pub work: RECT,
    pub primary: bool,
}

unsafe extern "system" fn visit(monitor: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> BOOL {
    // SAFETY: `data` is the `&mut Vec<Screen>` passed by `screens`, alive for the whole call.
    let list = unsafe { &mut *(data.0 as *mut Vec<Screen>) };
    let mut info = MONITORINFOEXW::default();
    info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;
    // SAFETY: `info` is sized as an extended monitor info, which GetMonitorInfoW accepts.
    let ok = unsafe { GetMonitorInfoW(monitor, &mut info as *mut _ as *mut MONITORINFO) };
    if ok.as_bool() {
        let name = String::from_utf16_lossy(&info.szDevice);
        let number = name
            .trim_end_matches('\0')
            .trim_start_matches(r"\\.\DISPLAY")
            .parse()
            .unwrap_or(0);
        list.push(Screen {
            number,
            work: info.monitorInfo.rcWork,
            primary: info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
        });
    }
    BOOL(1)
}

/// The screens, in Windows' order (by number; left to right when Windows gives none).
pub fn screens() -> Vec<Screen> {
    let mut list: Vec<Screen> = Vec::new();
    // SAFETY: the callback only touches `list`, which outlives the synchronous call.
    unsafe {
        let _ = EnumDisplayMonitors(
            None,
            None,
            Some(visit),
            LPARAM(&mut list as *mut Vec<Screen> as isize),
        );
    }
    order(&mut list);
    list
}

/// By Windows' number; screens without one (0) after, left to right; then renumbered 1, 2… so
/// that « le premier écran » is always the first of the list.
fn order(list: &mut [Screen]) {
    list.sort_by_key(|s| (s.number == 0, s.number, s.work.left, s.work.top));
    for (i, s) in list.iter_mut().enumerate() {
        s.number = i as u32 + 1;
    }
}

/// Where a window of `size` goes on `screen`: centred, never larger than the screen.
fn place(size: (i32, i32), screen: &RECT) -> RECT {
    let (sw, sh) = (screen.right - screen.left, screen.bottom - screen.top);
    let (w, h) = (size.0.min(sw).max(1), size.1.min(sh).max(1));
    let left = screen.left + (sw - w) / 2;
    let top = screen.top + (sh - h) / 2;
    RECT {
        left,
        top,
        right: left + w,
        bottom: top + h,
    }
}

/// Puts the main window of one of `pids` on screen `number` (1 = the first), maximized again if
/// it was. `false`: no such screen, or no window yet.
pub fn move_to(pids: &[u32], number: u32) -> bool {
    let Some(hwnd) = super::window::main_window(pids) else {
        return false;
    };
    move_window_to(hwnd, number)
}

/// The window `hwnd` on screen `number`. `false`: no such screen.
pub fn move_window_to(hwnd: HWND, number: u32) -> bool {
    match screens().into_iter().find(|s| s.number == number) {
        Some(screen) => move_window(hwnd, &screen),
        None => false,
    }
}

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

/// The number of the screen holding the window's centre (1 = the first).
pub fn number_of(hwnd: HWND) -> Option<u32> {
    let mut rect = RECT::default();
    // SAFETY: a read-only query; a stale handle makes it fail.
    if unsafe { GetWindowRect(hwnd, &mut rect) }.is_err() {
        return None;
    }
    let (x, y) = ((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
    screens()
        .into_iter()
        .find(|s| s.work.left <= x && x < s.work.right && s.work.top <= y && y < s.work.bottom)
        .map(|s| s.number)
}

fn move_window(hwnd: HWND, screen: &Screen) -> bool {
    // SAFETY: `hwnd` came from the enumeration a moment ago; a stale handle only makes the
    // calls fail.
    unsafe {
        let maximized = IsZoomed(hwnd).as_bool();
        if maximized {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return false;
        }
        let to = place(
            (rect.right - rect.left, rect.bottom - rect.top),
            &screen.work,
        );
        let moved = SetWindowPos(
            hwnd,
            None,
            to.left,
            to.top,
            to.right - to.left,
            to.bottom - to.top,
            SWP_NOZORDER | SWP_NOACTIVATE,
        )
        .is_ok();
        if maximized {
            let _ = ShowWindow(hwnd, SW_MAXIMIZE);
        }
        moved
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn screen(number: u32, left: i32) -> Screen {
        Screen {
            number,
            work: RECT {
                left,
                top: 0,
                right: left + 1920,
                bottom: 1040,
            },
            primary: false,
        }
    }

    #[test]
    fn screens_follow_windows_numbers_then_the_left_to_right_order() {
        let mut list = vec![screen(2, -1920), screen(1, 0), screen(0, 1920)];
        order(&mut list);
        assert_eq!(
            list.iter()
                .map(|s| (s.number, s.work.left))
                .collect::<Vec<_>>(),
            [(1, 0), (2, -1920), (3, 1920)]
        );
    }

    #[test]
    fn a_window_is_centred_and_never_larger_than_its_screen() {
        let to = place((800, 600), &screen(1, 1920).work);
        assert_eq!(
            (to.left, to.top, to.right, to.bottom),
            (2480, 220, 3280, 820)
        );
        let big = place((4000, 3000), &screen(1, 0).work);
        assert_eq!(
            (big.left, big.top, big.right, big.bottom),
            (0, 0, 1920, 1040)
        );
    }
}

/// This PC's screens as Kayro numbers them: `cargo test -p hub screens_here -- --ignored
/// --nocapture` (nothing is moved).
#[cfg(test)]
#[test]
#[ignore]
fn screens_here() {
    for s in screens() {
        println!(
            "screen {}: {}x{} at ({}, {}){}",
            s.number,
            s.work.right - s.work.left,
            s.work.bottom - s.work.top,
            s.work.left,
            s.work.top,
            if s.primary { " (principal)" } else { "" }
        );
    }
}
