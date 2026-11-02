//! Styles of Kayro's own windows (the widget must stay out of the taskbar and Alt+Tab).

use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_TRANSITIONS_FORCEDISABLED};
use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYEVENTF_KEYUP, VK_MENU};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, GetForegroundWindow, GetWindowLongPtrW, GetWindowThreadProcessId,
    SetForegroundWindow, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_APPWINDOW, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW,
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

/// Whether a click (or the core) may make the window active, without the toolkit: its own
/// « focusable » setting re-applies every flag it keeps, its « hidden » one too, and the island is
/// shown and hidden by the core (it would vanish at the first click, 0.20.2).
pub fn set_activatable(raw: isize, on: bool) {
    // SAFETY: plain style read/write on a window of this process; a stale handle just fails.
    unsafe {
        let style = GetWindowLongPtrW(hwnd(raw), GWL_EXSTYLE);
        let no = WS_EX_NOACTIVATE.0 as isize;
        let wanted = if on { style & !no } else { style | no };
        if wanted != style {
            SetWindowLongPtrW(hwnd(raw), GWL_EXSTYLE, wanted);
        }
    }
}

/// Windows' own fade when the window is shown or hidden (round 5). Off for the immersive hub: it
/// makes its own entrance (the opening, the passages), and the system fade let the previous screen
/// show through it for ~200 ms at launch. On for a normal window, like any program.
pub fn set_show_animation(raw: isize, on: bool) {
    // A Win32 BOOL.
    let disabled: i32 = (!on).into();
    // SAFETY: a DWM attribute of a window of this process; a stale handle just fails.
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd(raw),
            DWMWA_TRANSITIONS_FORCEDISABLED,
            &disabled as *const _ as *const _,
            std::mem::size_of_val(&disabled) as u32,
        );
    }
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
