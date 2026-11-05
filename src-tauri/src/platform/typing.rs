//! Step 21, dictation (« écris bonjour », the user's go of 2026-11-05): the text typed into the
//! window in front, as keystrokes (SendInput, Unicode), nothing else: no Enter, no shortcut,
//! control characters dropped, 300 characters at most; refused in a console or a terminal
//! (a typed line could be a command there) and in Kayro's own windows.

use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    VIRTUAL_KEY,
};

use super::arrange;
use super::island::class_of;

const MOST: usize = 300;
/// Programs whose window takes typed lines as commands.
const CONSOLES: [&str; 6] = [
    "windowsterminal.exe",
    "cmd.exe",
    "powershell.exe",
    "pwsh.exe",
    "conhost.exe",
    "wt.exe",
];
const CONSOLE_CLASSES: [&str; 2] = ["ConsoleWindowClass", "CASCADIA_HOSTING_WINDOW_CLASS"];

/// The text as it may be typed: printable characters only, bounded.
pub fn clean(text: &str) -> String {
    text.chars()
        .filter(|c| !c.is_control())
        .take(MOST)
        .collect()
}

fn unicode(unit: u16, up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(0),
                wScan: unit,
                dwFlags: if up {
                    KEYEVENTF_UNICODE | KEYEVENTF_KEYUP
                } else {
                    KEYEVENTF_UNICODE
                },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

/// Types `text` into the window in front. `false`: nothing in front, Kayro's own window
/// (`own`), or a console.
pub fn type_text(own: u32, text: &str) -> bool {
    let text = clean(text);
    if text.is_empty() {
        return false;
    }
    let Some((hwnd, pid)) = arrange::front(own) else {
        return false;
    };
    let exe = super::process::exe_name(pid)
        .unwrap_or_default()
        .to_lowercase();
    if CONSOLES.contains(&exe.as_str()) || CONSOLE_CLASSES.contains(&class_of(hwnd).as_str()) {
        tracing::info!("voice: dictation refused in a console");
        return false;
    }
    let inputs: Vec<INPUT> = text
        .encode_utf16()
        .flat_map(|u| [unicode(u, false), unicode(u, true)])
        .collect();
    // SAFETY: plain keyboard events built above, the size of their struct.
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    sent as usize == inputs.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_text_typed_has_no_control_character_and_is_bounded() {
        assert_eq!(clean("bonjour\nrm -rf\t!"), "bonjourrm -rf!");
        assert_eq!(clean(&"a".repeat(500)).len(), MOST);
    }
}
