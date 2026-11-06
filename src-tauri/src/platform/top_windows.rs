//! The windows on screen (30/10, launch cover): every visible top-level window (not owned, not a
//! tool window, not minimised), whose process it is, and how much of its monitor it covers.

use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindow, GetWindowLongW, GetWindowRect, GetWindowThreadProcessId, IsIconic,
    IsWindowVisible, GWL_EXSTYLE, GW_OWNER, WS_EX_TOOLWINDOW,
};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TopWindow {
    /// The window's handle, as a number (only compared, never used to act on another window).
    pub hwnd: isize,
    pub pid: u32,
    /// Its area over its monitor's (0–1).
    pub share: f32,
}

fn area(r: &RECT) -> f32 {
    ((r.right - r.left).max(0) as f32) * ((r.bottom - r.top).max(0) as f32)
}

unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
    // SAFETY: `lparam` is the `&mut Vec` passed by `top_windows`, alive for the whole call.
    let list = unsafe { &mut *(lparam.0 as *mut Vec<TopWindow>) };
    // SAFETY: read-only queries on a handle the enumeration just gave.
    let shown = unsafe {
        IsWindowVisible(hwnd).as_bool()
            && !IsIconic(hwnd).as_bool()
            && GetWindow(hwnd, GW_OWNER).is_err()
            && GetWindowLongW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0 == 0
    };
    if !shown {
        return BOOL(1);
    }
    let mut pid = 0u32;
    let mut rect = RECT::default();
    let mut info = MONITORINFO {
        cbSize: size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    // SAFETY: the out-parameters outlive the calls; a stale handle only makes them fail.
    let measured = unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        GetWindowRect(hwnd, &mut rect).is_ok() && GetMonitorInfoW(monitor, &mut info).as_bool()
    };
    if measured && pid != 0 {
        list.push(TopWindow {
            hwnd: hwnd.0 as isize,
            pid,
            share: area(&rect) / area(&info.rcMonitor).max(1.0),
        });
    }
    BOOL(1)
}

/// The visible top-level windows, front to back.
pub fn top_windows() -> Vec<TopWindow> {
    let mut list: Vec<TopWindow> = Vec::new();
    // SAFETY: the callback only touches `list`, which outlives the synchronous call.
    unsafe {
        let _ = EnumWindows(
            Some(collect),
            LPARAM(&mut list as *mut Vec<TopWindow> as isize),
        );
    }
    list
}
