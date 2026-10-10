//! Styles of Kayro's own windows (the widget must stay out of the taskbar and Alt+Tab).

use windows::Win32::Foundation::HWND;
use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYEVENTF_KEYUP, VK_MENU};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, GetForegroundWindow, GetWindowLongPtrW, GetWindowThreadProcessId,
    SetForegroundWindow, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
};

fn hwnd(raw: isize) -> HWND {
    HWND(raw as *mut _)
}

/// Marks the window as a tool window: no taskbar button and not listed by Alt+Tab (Windows lists
/// a visible top-level window unless it has `WS_EX_TOOLWINDOW` and not `WS_EX_APPWINDOW`).
/// Call it while the window is still hidden so the shell never sees it with the old style.
pub fn set_tool_window(raw: isize) {
    // SAFETY: plain style read/write on a window of this process; a stale handle just fails.
    unsafe {
        let style = GetWindowLongPtrW(hwnd(raw), GWL_EXSTYLE);
        let wanted = (style & !(WS_EX_APPWINDOW.0 as isize)) | WS_EX_TOOLWINDOW.0 as isize;
        SetWindowLongPtrW(hwnd(raw), GWL_EXSTYLE, wanted);
    }
}

/// Extended style bits, for logging.
pub fn ex_style(raw: isize) -> u32 {
    // SAFETY: plain read.
    unsafe { GetWindowLongPtrW(hwnd(raw), GWL_EXSTYLE) as u32 }
}

pub fn is_tool_window(raw: isize) -> bool {
    let style = ex_style(raw);
    style & WS_EX_TOOLWINDOW.0 != 0 && style & WS_EX_APPWINDOW.0 == 0
}

/// Brings the window in front of everything and gives it the keyboard. Windows only lets the
/// program that has the user's attention do this: a shortcut that just fired counts, but a window
/// shown a moment later (economy mode builds it first) no longer does. Second try: share the
/// input queue of the window now in front, which makes the request legitimate; last try: a tap
/// on Alt counts as user input (same trick as `window::bring_to_front`). True when in front.
pub fn force_foreground(raw: isize) -> bool {
    let target = hwnd(raw);
    // SAFETY: plain window-manager calls on a window of this process and the one in front; a
    // stale handle just fails. The input queues are detached again before returning.
    unsafe {
        if SetForegroundWindow(target).as_bool() || GetForegroundWindow() == target {
            return true;
        }
        let front = GetForegroundWindow();
        let front_thread = GetWindowThreadProcessId(front, None);
        let this_thread = GetCurrentThreadId();
        if front_thread != 0 && front_thread != this_thread {
            let attached = AttachThreadInput(this_thread, front_thread, true).as_bool();
            let _ = BringWindowToTop(target);
            let done = SetForegroundWindow(target).as_bool();
            if attached {
                let _ = AttachThreadInput(this_thread, front_thread, false);
            }
            if done {
                return true;
            }
        }
        keybd_event(VK_MENU.0 as u8, 0, Default::default(), 0);
        keybd_event(VK_MENU.0 as u8, 0, KEYEVENTF_KEYUP, 0);
        SetForegroundWindow(target).as_bool()
    }
}
