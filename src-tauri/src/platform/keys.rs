//! Step 21, the voice: Windows' own volume keys (« plus fort », « moins fort », « coupe le son »),
//! pressed as a keyboard's media keys would be: the system volume and its on-screen indicator.

use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
    VIRTUAL_KEY, VK_VOLUME_DOWN, VK_VOLUME_MUTE, VK_VOLUME_UP,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Volume {
    Up,
    Down,
    Mute,
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

/// Presses the volume key `times` times (Windows moves the volume 2 % a press).
pub fn volume(what: Volume, times: u32) {
    let vk = match what {
        Volume::Up => VK_VOLUME_UP,
        Volume::Down => VK_VOLUME_DOWN,
        Volume::Mute => VK_VOLUME_MUTE,
    };
    let inputs: Vec<INPUT> = (0..times)
        .flat_map(|_| [key(vk, KEYBD_EVENT_FLAGS(0)), key(vk, KEYEVENTF_KEYUP)])
        .collect();
    // SAFETY: plain keyboard events built above, the size of their struct.
    unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
}
