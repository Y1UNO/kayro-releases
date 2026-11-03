//! Choices of the « Visuel » settings (R5): each one picks a variant of the art direction.
//! The defaults are the validated look; the page maps them onto the art-direction values.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

use super::schema::Settings;

/// « Mouvement »: `Lively` is the validated « Vivant intelligent » language.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum MotionStyle {
    /// The « magic » level also where the intelligence rule cuts it (window mode, big grid…).
    Complete,
    #[default]
    Lively,
    /// No bounce and no magic: entrance curve everywhere, card hover = lift only.
    Crisp,
}

/// « Flottaison des cartes » of the category fan and of the carousel.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum CardFloat {
    None,
    Light,
    #[default]
    Visible,
    Strong,
}

/// « Ouverture au lancement »: V1-A with the C pulse, V1-A alone, or nothing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum OpeningStyle {
    #[default]
    Pulse,
    Classic,
    None,
}

/// « Changement de thème »: the wave with its impact, a cross-fade, or a direct switch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ThemeTransition {
    #[default]
    Wave,
    Fade,
    Direct,
}

/// « Écran d'ouverture » (step 15): where the hub opens from the shortcut or the notification area.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum OpeningScreen {
    /// Where it was last (the remembered screen).
    #[default]
    Last,
    /// The screen under the mouse pointer.
    Pointer,
    /// The main screen of Windows.
    Main,
}

/// « Dépliage du widget ».
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum WidgetUnroll {
    #[default]
    Unroll,
    Sober,
}

/// Step 20 (Kysland): how the floating island goes from one screen to another. « Forcer »: the
/// edge holds it until it is pushed through (bubbles); « Glitch »: no resistance, it may sit
/// across two screens, and the edge between them glitches around it (spikes).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum IslandPassage {
    #[default]
    Force,
    Glitch,
}

/// Kysland's « Mode musique » › Avancé › « Qualité » (2026-11-03): the disc's resolution, « Auto »
/// lowering it by itself when an image takes too long.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum MusicQuality {
    #[default]
    Auto,
    Low,
    Medium,
    High,
}

/// « Couleurs » of the music mode: the cover's two colours, or Kayro's theme.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum MusicColors {
    #[default]
    Cover,
    Theme,
}

/// Bounds of the music mode's numbers: bass and crash strength ×0–2 (trails and gloss 0–1), the
/// detection sensitivities 0.5–2, and the image's delay after the sound 0–250 ms (Bluetooth
/// headphones play late; the image cannot come before the sound is heard, so never negative).
pub const MUSIC_STRENGTH_MAX: f32 = 2.0;
pub const MUSIC_SENSE_MIN: f32 = 0.5;
pub const MUSIC_SENSE_MAX: f32 = 2.0;
pub const MUSIC_DELAY_MAX_MS: f32 = 250.0;

impl Settings {
    /// The music mode's numbers brought back into their bounds (a patch never fails on them).
    pub(super) fn clamp_music(&mut self) {
        let strength = |v: f32| v.clamp(0.0, MUSIC_STRENGTH_MAX);
        let sense = |v: f32| v.clamp(MUSIC_SENSE_MIN, MUSIC_SENSE_MAX);
        self.music_bass = strength(self.music_bass);
        self.music_crash = strength(self.music_crash);
        self.music_trails = self.music_trails.clamp(0.0, 1.0);
        self.music_gloss = self.music_gloss.clamp(0.0, 1.0);
        self.music_sense_kick = sense(self.music_sense_kick);
        self.music_sense_snare = sense(self.music_sense_snare);
        self.music_sense_hat = sense(self.music_sense_hat);
        self.music_sense_crash = sense(self.music_sense_crash);
        self.music_delay_ms = self.music_delay_ms.clamp(0.0, MUSIC_DELAY_MAX_MS);
    }

    /// All of them within their bounds (a hand-edited file may say otherwise).
    pub(super) fn music_in_bounds(&self) -> bool {
        let mut clamped = self.clone();
        clamped.clamp_music();
        clamped == *self
    }
}

/// « Au démarrage » (started with Windows): the intro (the still logo, a click or Enter plays the
/// opening), the hub in immersive mode, the island (Kysland), or nothing on screen (the
/// notification area).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum StartupOpen {
    #[default]
    Intro,
    Immersive,
    Island,
    Hidden,
}

/// « Après l'intro »: what the intro's opening ends on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum StartupAfter {
    #[default]
    Immersive,
    Island,
    Hidden,
}

/// v2 → v3 (start-up choices): « Écran d'accueil » becomes the intro, « Discret » hidden.
pub fn settings_v2_to_v3(mut v: Value) -> Result<Value, String> {
    let o = v.as_object_mut().ok_or("not an object")?;
    if !o.contains_key("startupOpen") {
        let home = o
            .get("startupHome")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        o.insert(
            "startupOpen".into(),
            (if home { "intro" } else { "hidden" }).into(),
        );
    }
    Ok(v)
}

/// « Élasticité du widget »: overshoot of its springs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Elasticity {
    Soft,
    #[default]
    Normal,
    Strong,
}

/// « Survol des cartes » (app cards): threads + sheen, lift only, or nothing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum CardHoverStyle {
    #[default]
    Full,
    Simple,
    None,
}

/// Mauve was replaced by Encre (R5).
const RENAMED_THEMES: [(&str, &str); 1] = [("mauve", "encre")];
/// The five themes before the logo ones; retired at the art-direction freeze (R5).
const RETIRED_THEMES: [&str; 5] = ["crepuscule", "boreale", "ocean", "rose", "graphite"];
/// Default theme since R5.
pub const DEFAULT_THEME: &str = "bleu-gris";

/// Settings v1 → v2: renamed and retired themes. New fields need nothing (their defaults fill in).
pub fn settings_v1_to_v2(mut v: Value) -> Result<Value, String> {
    let o = v.as_object_mut().ok_or("not an object")?;
    if let Some(id) = o.get("themeId").and_then(Value::as_str) {
        let next = RENAMED_THEMES
            .iter()
            .find(|(old, _)| *old == id)
            .map(|(_, new)| *new)
            .or_else(|| RETIRED_THEMES.contains(&id).then_some(DEFAULT_THEME));
        if let Some(next) = next {
            o.insert("themeId".into(), next.into());
        }
    }
    Ok(v)
}
