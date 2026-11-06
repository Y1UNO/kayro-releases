//! Step 22: the hands' mouse, through `SendInput` (the same path as a real mouse). Windows does
//! not let it reach a window run as administrator from Kayro (not elevated): those ignore it.

use windows::Win32::Foundation::POINT;
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    MONITOR_DEFAULTTONULL, MONITOR_FROM_FLAGS,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_ABSOLUTE, MOUSEEVENTF_LEFTDOWN,
    MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MOVE, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP,
    MOUSEEVENTF_VIRTUALDESK, MOUSEINPUT, MOUSE_EVENT_FLAGS,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
    SM_YVIRTUALSCREEN,
};

/// A screen's rectangle on the desktop (physical pixels): left, top, width, height.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Screen {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// The screen under the cursor now.
pub fn screen_under_cursor() -> Option<Screen> {
    let (x, y) = cursor()?;
    monitor(POINT { x, y }, MONITOR_DEFAULTTONEAREST)
}

/// The screen at `x`, `y` (physical pixels of the desktop), if one is there.
pub fn screen_at(x: i32, y: i32) -> Option<Screen> {
    monitor(POINT { x, y }, MONITOR_DEFAULTTONULL)
}

fn monitor(p: POINT, flags: MONITOR_FROM_FLAGS) -> Option<Screen> {
    // SAFETY: plain queries with structures owned here.
    unsafe {
        let monitor = MonitorFromPoint(p, flags);
        if monitor.is_invalid() {
            return None;
        }
        let mut info = MONITORINFO {
            cbSize: size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return None;
        }
        let r = info.rcMonitor;
        Some(Screen {
            x: r.left,
            y: r.top,
            w: r.right - r.left,
            h: r.bottom - r.top,
        })
    }
}

fn send(flags: MOUSE_EVENT_FLAGS, dx: i32, dy: i32) {
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx,
                dy,
                mouseData: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    // SAFETY: one input of its own size; a refusal (a secure desktop) only drops it.
    unsafe {
        SendInput(&[input], size_of::<INPUT>() as i32);
    }
}

/// The whole desktop (every screen), physical pixels.
pub fn desktop() -> Screen {
    // SAFETY: plain metrics.
    unsafe {
        Screen {
            x: GetSystemMetrics(SM_XVIRTUALSCREEN),
            y: GetSystemMetrics(SM_YVIRTUALSCREEN),
            w: GetSystemMetrics(SM_CXVIRTUALSCREEN).max(2),
            h: GetSystemMetrics(SM_CYVIRTUALSCREEN).max(2),
        }
    }
}

/// The cursor to `x`, `y` (physical pixels of the desktop).
pub fn move_to(x: i32, y: i32) {
    let Screen {
        x: vx,
        y: vy,
        w: vw,
        h: vh,
    } = desktop();
    // Absolute moves are 0–65535 across the whole desktop (every screen).
    let nx = ((i64::from(x - vx) * 65_535) / i64::from(vw - 1)) as i32;
    let ny = ((i64::from(y - vy) * 65_535) / i64::from(vh - 1)) as i32;
    send(
        MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
        nx,
        ny,
    );
}

pub fn button(left: bool, down: bool) {
    let flag = match (left, down) {
        (true, true) => MOUSEEVENTF_LEFTDOWN,
        (true, false) => MOUSEEVENTF_LEFTUP,
        (false, true) => MOUSEEVENTF_RIGHTDOWN,
        (false, false) => MOUSEEVENTF_RIGHTUP,
    };
    send(flag, 0, 0);
}

/// Where the cursor is (physical pixels of the desktop).
pub fn cursor() -> Option<(i32, i32)> {
    let mut p = POINT::default();
    // SAFETY: a plain query into a point owned here.
    unsafe { GetCursorPos(&mut p) }.ok()?;
    Some((p.x, p.y))
}
