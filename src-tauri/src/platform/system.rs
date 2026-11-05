//! Step 21, the voice: a few things of the session itself — locking it (« verrouille
//! l'écran »), showing the desktop (Windows' own Win+D), the time of day (« quelle heure
//! est-il ? »). A fixed list: a sentence never runs anything else.

use windows::Win32::System::Shutdown::LockWorkStation;
use windows::Win32::System::SystemInformation::GetLocalTime;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
    VIRTUAL_KEY, VK_LWIN, VK_SNAPSHOT,
};

/// Locks the session, as Win+L does.
pub fn lock() -> bool {
    // SAFETY: no arguments; a failure just leaves the session as it is.
    unsafe { LockWorkStation().is_ok() }
}

fn key(vk: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

/// Shows the desktop (the Win+D shortcut, the only way Windows offers): every window is
/// minimised, and again brings them back.
pub fn show_desktop() {
    const VK_D: VIRTUAL_KEY = VIRTUAL_KEY(0x44);
    let inputs = [
        key(VK_LWIN, KEYBD_EVENT_FLAGS(0)),
        key(VK_D, KEYBD_EVENT_FLAGS(0)),
        key(VK_D, KEYEVENTF_KEYUP),
        key(VK_LWIN, KEYEVENTF_KEYUP),
    ];
    // SAFETY: plain keyboard events built above, the size of their struct.
    unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
}

/// File Explorer, as Windows opens it on Win+E (« ouvre l'explorateur de fichiers »).
pub fn file_explorer() {
    const VK_E: VIRTUAL_KEY = VIRTUAL_KEY(0x45);
    let inputs = [
        key(VK_LWIN, KEYBD_EVENT_FLAGS(0)),
        key(VK_E, KEYBD_EVENT_FLAGS(0)),
        key(VK_E, KEYEVENTF_KEYUP),
        key(VK_LWIN, KEYEVENTF_KEYUP),
    ];
    // SAFETY: plain keyboard events built above, the size of their struct.
    unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
}

/// A screenshot as Windows takes it on Win+Impr: saved by Windows in Images\Captures (Kayro
/// writes no file).
pub fn screenshot() {
    let inputs = [
        key(VK_LWIN, KEYBD_EVENT_FLAGS(0)),
        key(VK_SNAPSHOT, KEYBD_EVENT_FLAGS(0)),
        key(VK_SNAPSHOT, KEYEVENTF_KEYUP),
        key(VK_LWIN, KEYEVENTF_KEYUP),
    ];
    // SAFETY: plain keyboard events built above, the size of their struct.
    unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
}

/// The local time of day: hour and minute.
pub fn local_time() -> (u16, u16) {
    // SAFETY: fills a plain struct.
    let t = unsafe { GetLocalTime() };
    (t.wHour, t.wMinute)
}
