//! Other programs' processes (30/10, launch cover): the file name behind a process id, and the
//! leave for any program to come to the front once (a game started by its store's launcher).

use windows::core::PWSTR;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{AllowSetForegroundWindow, ASFW_ANY};

/// File name of the process' executable, lower-cased (`steam.exe`); `None` when Windows does not
/// let us read it (a process of another user, an elevated one…).
pub fn exe_name(pid: u32) -> Option<String> {
    // SAFETY: the limited query right is enough to read the image name; the handle is closed
    // below on every path.
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok()?;
    let mut buf = [0u16; 1024];
    let mut len = buf.len() as u32;
    // SAFETY: `buf` and `len` outlive the call; `len` holds the buffer's size in characters.
    let read = unsafe {
        QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        )
    };
    // SAFETY: `handle` was opened above and is not used afterwards.
    let _ = unsafe { CloseHandle(handle) };
    read.ok()?;
    let path = String::from_utf16_lossy(&buf[..len as usize]);
    path.rsplit(['\\', '/'])
        .next()
        .map(|name| name.to_ascii_lowercase())
}

/// Lets the next program that asks come to the front (Windows otherwise only flashes its
/// taskbar button). Only works while the hub itself is the window in front.
pub fn allow_any_foreground() {
    // SAFETY: no pointer; a refusal (the hub not in front) is harmless.
    let _ = unsafe { AllowSetForegroundWindow(ASFW_ANY) };
}
