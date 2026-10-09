//! Windows of other programs: who is in front, bringing one forward, and a hook that tells us
//! when the foreground window changes.

use std::sync::OnceLock;

use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM};
use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYEVENTF_KEYUP, VK_MENU};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetForegroundWindow, GetMessageW, GetWindow, GetWindowLongW, GetWindowTextLengthW,
    GetWindowThreadProcessId, IsIconic, IsWindowVisible, PostMessageW, SetForegroundWindow,
    ShowWindow, EVENT_SYSTEM_FOREGROUND, GWL_EXSTYLE, GW_OWNER, MSG, SW_RESTORE,
    WINEVENT_OUTOFCONTEXT, WM_CLOSE, WS_EX_TOOLWINDOW,
};

use super::Win32Error;

fn pid_of(hwnd: HWND) -> Option<u32> {
    let mut pid = 0u32;
    // SAFETY: `pid` outlives the call; an invalid handle just yields 0.
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    (pid != 0).then_some(pid)
}

/// Process owning the window currently in front (`None` on the lock screen, etc.).
pub fn foreground_pid() -> Option<u32> {
    // SAFETY: no arguments; a null result is handled by `pid_of`.
    pid_of(unsafe { GetForegroundWindow() })
}

struct Search<'a> {
    pids: &'a [u32],
    found: Option<HWND>,
}

unsafe extern "system" fn visit(hwnd: HWND, lparam: LPARAM) -> BOOL {
    // SAFETY: `lparam` is the `&mut Search` passed by `main_window`, alive for the whole call.
    let search = unsafe { &mut *(lparam.0 as *mut Search) };
    let mine = pid_of(hwnd).is_some_and(|p| search.pids.contains(&p));
    // Top-level, visible, titled, not a tool window: what the user sees as «the app's window».
    let shown = unsafe {
        mine && IsWindowVisible(hwnd).as_bool()
            && GetWindow(hwnd, GW_OWNER).is_err()
            && GetWindowLongW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0 == 0
            && GetWindowTextLengthW(hwnd) > 0
    };
    if shown {
        search.found = Some(hwnd);
        return BOOL(0); // stop: the first match is the topmost one
    }
    BOOL(1)
}

fn main_window(pids: &[u32]) -> Option<HWND> {
    let mut search = Search { pids, found: None };
    // SAFETY: the callback only touches `search`, which outlives the synchronous call.
    // `EnumWindows` reports an error when the callback stops early: expected, ignored.
    unsafe {
        let _ = EnumWindows(Some(visit), LPARAM(&mut search as *mut Search as isize));
    }
    search.found
}

/// Brings the main window of one of `pids` to the front, restoring it if minimised.
/// Returns false when there is no such window or Windows refused the switch.
pub fn bring_to_front(pids: &[u32]) -> bool {
    let Some(hwnd) = main_window(pids) else {
        return false;
    };
    // SAFETY: `hwnd` came from the enumeration a moment ago; a stale handle only makes the
    // calls fail.
    unsafe {
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        if SetForegroundWindow(hwnd).as_bool() {
            return true;
        }
        // Windows only lets the process that has the user's attention switch windows. A tap on
        // Alt counts as user input and lifts that restriction for the next call.
        keybd_event(VK_MENU.0 as u8, 0, Default::default(), 0);
        keybd_event(VK_MENU.0 as u8, 0, KEYEVENTF_KEYUP, 0);
        SetForegroundWindow(hwnd).as_bool()
    }
}

/// Asks the main window of one of `pids` to close (WM_CLOSE: the app decides, nothing is forced).
/// Used by the spike now, by the scene engine's `close` step later.
pub fn post_close(pids: &[u32]) -> bool {
    let Some(hwnd) = main_window(pids) else {
        return false;
    };
    // SAFETY: plain message post; a stale handle just fails.
    unsafe { PostMessageW(Some(hwnd), WM_CLOSE, Default::default(), Default::default()) }.is_ok()
}

type Sink = Box<dyn Fn(u32) + Send + Sync>;
static SINK: OnceLock<Sink> = OnceLock::new();

unsafe extern "system" fn on_foreground(
    _hook: HWINEVENTHOOK,
    _event: u32,
    hwnd: HWND,
    _object: i32,
    _child: i32,
    _thread: u32,
    _time: u32,
) {
    if let (Some(sink), Some(pid)) = (SINK.get(), pid_of(hwnd)) {
        sink(pid);
    }
}

/// Calls `notify(pid)` every time another program's window comes to the front. One dedicated
/// thread runs the message loop the hook needs; between events it sleeps in `GetMessageW`
/// (no polling). Call it at most once.
pub fn start_foreground_hook(
    notify: impl Fn(u32) + Send + Sync + 'static,
) -> Result<(), Win32Error> {
    if SINK.set(Box::new(notify)).is_err() {
        return Err(Win32Error(0));
    }
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::Builder::new()
        .name("foreground-hook".into())
        .spawn(move || {
            // SAFETY: out-of-context hook: the callback runs on this thread, from the message
            // loop below; the hook lives as long as the process.
            let hook = unsafe {
                SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    None,
                    Some(on_foreground),
                    0,
                    0,
                    WINEVENT_OUTOFCONTEXT,
                )
            };
            let _ = tx.send(!hook.is_invalid());
            if hook.is_invalid() {
                return;
            }
            let mut msg = MSG::default();
            // SAFETY: standard message loop; ends on WM_QUIT or an error (returns <= 0).
            while unsafe { GetMessageW(&mut msg, None, 0, 0) }.0 > 0 {}
        })
        .map_err(|_| Win32Error(0))?;
    match rx.recv() {
        Ok(true) => Ok(()),
        _ => Err(Win32Error::last()),
    }
}
