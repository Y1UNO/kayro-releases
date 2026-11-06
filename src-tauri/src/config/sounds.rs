//! Step 17b, Réglages › Sons: the style of the sounds (synthesised by the interface, nothing to
//! download) and the bounds of their volume.

use serde::{Deserialize, Serialize};
use specta::Type;

/// « Style des sons »: crystalline and soft (the default), a warm analogue synth, or 8-bit.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum SoundPack {
    #[default]
    Premium,
    Retro,
    Chiptune,
}

/// Bounds of `Settings::sound_volume` (0 = silent, 1 = full).
pub const SOUND_VOLUME_MIN: f32 = 0.0;
pub const SOUND_VOLUME_MAX: f32 = 1.0;
/// Low by default: the sounds accompany, they never cover a voice chat or the game.
pub const SOUND_VOLUME_DEFAULT: f32 = 0.4;
