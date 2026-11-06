//! Step 21, the voice: a window already open, arranged by a sentence (« mets Discord en plein
//! écran », « réduis ça », « à gauche », « sur l'écran 2 ») — the main window of one of the
//! user's apps, or the one in front. Nothing is launched here; Kayro's own windows are never
//! touched.

use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId, IsZoomed, SetWindowPos,
    ShowWindow, SWP_NOACTIVATE, SWP_NOZORDER, SW_MAXIMIZE, SW_MINIMIZE, SW_RESTORE,
};

/// What is done to the window.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Arrange {
    Maximize,
    Minimize,
    Restore,
    /// The left half of its screen.
    Left,
    Right,
    /// Centred on screen `n` (1 = the first), as big as it was.
    Screen(u32),
}

/// The window in front and its process, unless it is Kayro's own (`own`) or there is none.
pub fn front(own: u32) -> Option<(HWND, u32)> {
    // SAFETY: read-only queries; a null or stale handle just gives nothing.
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        (pid != 0 && pid != own).then_some((hwnd, pid))
    }
}

/// The window's title (what its title bar shows), at most 80 characters.
pub fn title(hwnd: HWND) -> String {
    let mut buf = [0u16; 128];
    // SAFETY: the buffer outlives the call, which writes at most its length.
    let n = unsafe { GetWindowTextW(hwnd, &mut buf) };
    String::from_utf16_lossy(&buf[..n.max(0) as usize])
        .chars()
        .take(80)
        .collect()
}

/// The screen the window is on (its work area, without the taskbar).
fn work_area(hwnd: HWND) -> Option<RECT> {
    // SAFETY: the info struct is sized before the call; a stale handle makes it fail.
    unsafe {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        GetMonitorInfoW(monitor, &mut info)
            .as_bool()
            .then_some(info.rcWork)
    }
}

/// The window `hwnd`, arranged. `false`: Windows refused, or no such screen.
pub fn arrange(hwnd: HWND, what: Arrange) -> bool {
    // SAFETY: `hwnd` was in front a moment ago; a stale handle only makes the calls fail.
    unsafe {
        match what {
            Arrange::Maximize => ShowWindow(hwnd, SW_MAXIMIZE).as_bool() || true,
            Arrange::Minimize => ShowWindow(hwnd, SW_MINIMIZE).as_bool() || true,
            Arrange::Restore => ShowWindow(hwnd, SW_RESTORE).as_bool() || true,
            Arrange::Left | Arrange::Right => {
                let Some(work) = work_area(hwnd) else {
                    return false;
                };
                if IsZoomed(hwnd).as_bool() {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                }
                let half = (work.right - work.left) / 2;
                let left = if what == Arrange::Left {
                    work.left
                } else {
                    work.left + half
                };
                SetWindowPos(
                    hwnd,
                    None,
                    left,
                    work.top,
                    half,
                    work.bottom - work.top,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                )
                .is_ok()
            }
            Arrange::Screen(n) => super::screens::move_window_to(hwnd, n),
        }
    }
}
