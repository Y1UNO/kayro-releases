//! Step 22, the hands: their settings (Réglages › Mains). Off by default: the camera is never
//! opened until the user installs the hands and presses their shortcut.

use serde::{Deserialize, Serialize};
use specta::Type;

pub const HANDS_HOTKEY_DEFAULT: &str = "Ctrl+Alt+M";

/// Read as a whole: a settings file without it (older), or with a broken one, keeps the default.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HandsSettings {
    /// The hands are set up: their shortcut is registered (the camera still waits for it).
    pub enabled: bool,
    /// Turns the camera (and the mouse in the air) on and off.
    pub hotkey: String,
    /// Keep the camera while a program in full screen (a game) is in front; off: it closes until
    /// it leaves.
    pub in_game: bool,
    /// Minutes without a hand in front of the camera before it turns itself off (1–30).
    pub idle_minutes: u32,
    /// How far the hand travels for the cursor to cross the screen (« Amplitude »): 0.5 (a small
    /// move) – 2.
    pub reach: f32,
    /// The glow under the cursor while the hand leads it.
    pub glow: bool,
    /// The finger that meets the thumb for a right click (the user's choice, 2026-11-05).
    #[serde(default)]
    pub right_finger: RightFinger,
}

/// Thumb – ring finger or thumb – middle finger: the right click.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RightFinger {
    #[default]
    Ring,
    Middle,
}

impl Default for HandsSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            hotkey: HANDS_HOTKEY_DEFAULT.into(),
            in_game: false,
            idle_minutes: 2,
            reach: 1.0,
            glow: true,
            right_finger: RightFinger::Ring,
        }
    }
}

impl HandsSettings {
    pub fn in_bounds(&self) -> bool {
        (1..=30).contains(&self.idle_minutes) && (0.5..=2.0).contains(&self.reach)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_hands_are_off_by_default_and_an_older_settings_file_reads_as_off() {
        use crate::config::schema::Settings;
        use crate::config::store::{lenient_merge, LoadReport};
        assert!(!HandsSettings::default().enabled);
        assert!(HandsSettings::default().in_bounds());
        let mut file = serde_json::to_value(Settings::default()).unwrap();
        file.as_object_mut().unwrap().remove("hands");
        let old: Settings = lenient_merge(file, &mut LoadReport::default(), |_| Ok(()));
        assert_eq!(old.hands, HandsSettings::default());
        let wild = HandsSettings {
            reach: 9.0,
            ..Default::default()
        };
        assert!(!wild.in_bounds());
    }
}
