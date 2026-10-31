//! Typed shape of the small documents: settings, slots, and the shared (strict) files
//! scenes and themes. Apps live in `apps.rs`.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

pub use super::game_colors::{
    ColorCharacter, ColorIntensity, ColorPassage, ColorPick, ColorTrigger,
};
use super::migrate::{current_version, Migration};
pub use super::scene::SceneFile;
use super::store::{lenient_merge, Document, LoadReport};
use super::validate::validate_settings;
use super::visual::{settings_v1_to_v2, DEFAULT_THEME};
pub use super::sounds::SoundPack;
use super::sounds::SOUND_VOLUME_DEFAULT;
pub use super::visual::{
    CardFloat, CardHoverStyle, Elasticity, IslandPassage, MotionStyle, OpeningScreen,
    OpeningStyle, ThemeTransition, WidgetUnroll,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    /// « Auto »: high, with the engine's automatic fallback (full adaptive quality: step 13).
    Auto,
    Eco,
    #[default]
    Balanced,
    High,
    Ultra,
}

/// How much the colours of the selected game tint the interface (DESIGN.md).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ColorMode {
    Off,
    /// « Stylisé » (30/10): the ambience and the accents take the game's colours. The immersive
    /// mode was removed that day: an older file's `immersive` reads as this one.
    #[default]
    #[serde(alias = "immersive")]
    Light,
}

/// How the hub is shown: a borderless window the size of the chosen screen, a normal window,
/// or a small bar at the top of the screen (ARCHITECTURE.md §4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum DisplayMode {
    #[default]
    Immersive,
    Window,
    Widget,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub schema_version: u32,
    pub theme_id: String,
    pub quality: Quality,
    pub color_mode: ColorMode,
    pub hotkey: String,
    pub language: String,
    /// Strength of the animated atmosphere (fog, light, dust), 0.3–1.3 (« Atmosphère »).
    pub atmosphere_intensity: f32,
    pub display_mode: DisplayMode,
    /// Escape hides the hub once there is nothing left to close.
    pub hide_on_escape: bool,
    /// Losing the focus hides the hub (the widget only folds its panel).
    pub hide_on_blur: bool,
    /// « Mode économe »: the window is destroyed while hidden (less memory, slower to come back).
    pub economy_mode: bool,
    pub motion_style: MotionStyle,
    /// Follow Windows « Effets d'animation » (reduce motion); off = Kayro ignores it.
    pub follow_system_motion: bool,
    pub card_float: CardFloat,
    pub opening_style: OpeningStyle,
    pub theme_transition: ThemeTransition,
    pub opening_screen: OpeningScreen,
    pub widget_unroll: WidgetUnroll,
    pub widget_spring: Elasticity,
    /// Step 20: « Passage de Kysland » (from one screen to another).
    pub island_passage: IslandPassage,
    pub card_hover: CardHoverStyle,
    pub bokeh: bool,
    pub particles: bool,
    pub cursor_light: bool,
    /// Game colours (step 14, « Personnalisation avancée »): V1, V6, V5, V7, V8.
    pub color_intensity: ColorIntensity,
    pub color_character: ColorCharacter,
    pub color_pick: ColorPick,
    pub color_passage: ColorPassage,
    pub color_trigger: ColorTrigger,
    /// An app without a picture takes its icon's colours (V10 b); off = the theme's.
    pub color_from_icon: bool,
    /// Step 17b, Réglages › Sons: on, style, volume (0–1), and the three families.
    pub sounds_on: bool,
    pub sound_pack: SoundPack,
    pub sound_volume: f32,
    pub sound_interface: bool,
    pub sound_transitions: bool,
    pub sound_launch: bool,
    /// Step 18b: one look for an update at start (network: off unless the user allows it).
    pub update_auto: bool,
    /// Step 19: started with Windows, the hub opens on its home screen (still logo) instead of
    /// waiting in the notification area.
    pub startup_home: bool,
    /// Step 19b: detected apps the user chose to ignore (their ids), hidden from the next scans.
    pub ignored_detections: Vec<String>,
}

/// Bounds of [`Settings::atmosphere_intensity`].
pub const ATMOSPHERE_MIN: f32 = 0.3;
pub const ATMOSPHERE_MAX: f32 = 1.3;
/// « Normale »: the validated look.
pub const ATMOSPHERE_DEFAULT: f32 = 1.0;

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: current_version(SETTINGS_MIGRATIONS),
            theme_id: DEFAULT_THEME.into(),
            quality: Quality::default(),
            color_mode: ColorMode::default(),
            hotkey: "Ctrl+Alt+H".into(),
            language: "fr".into(),
            atmosphere_intensity: ATMOSPHERE_DEFAULT,
            display_mode: DisplayMode::default(),
            hide_on_escape: true,
            hide_on_blur: false,
            economy_mode: false,
            motion_style: MotionStyle::default(),
            follow_system_motion: true,
            card_float: CardFloat::default(),
            opening_style: OpeningStyle::default(),
            theme_transition: ThemeTransition::default(),
            opening_screen: OpeningScreen::default(),
            widget_unroll: WidgetUnroll::default(),
            island_passage: IslandPassage::default(),
            widget_spring: Elasticity::default(),
            card_hover: CardHoverStyle::default(),
            bokeh: true,
            particles: true,
            cursor_light: true,
            color_intensity: ColorIntensity::default(),
            color_character: ColorCharacter::default(),
            color_pick: ColorPick::default(),
            color_passage: ColorPassage::default(),
            color_trigger: ColorTrigger::default(),
            color_from_icon: true,
            sounds_on: true,
            sound_pack: SoundPack::default(),
            sound_volume: SOUND_VOLUME_DEFAULT,
            sound_interface: true,
            sound_transitions: true,
            sound_launch: true,
            update_auto: false,
            startup_home: false,
            ignored_detections: Vec::new(),
        }
    }
}

/// Partial update: absent (or null) fields are left as they are.
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct SettingsPatch {
    pub theme_id: Option<String>,
    pub quality: Option<Quality>,
    pub color_mode: Option<ColorMode>,
    pub hotkey: Option<String>,
    pub language: Option<String>,
    pub atmosphere_intensity: Option<f32>,
    pub display_mode: Option<DisplayMode>,
    pub hide_on_escape: Option<bool>,
    pub hide_on_blur: Option<bool>,
    pub economy_mode: Option<bool>,
    pub motion_style: Option<MotionStyle>,
    pub follow_system_motion: Option<bool>,
    pub card_float: Option<CardFloat>,
    pub opening_style: Option<OpeningStyle>,
    pub theme_transition: Option<ThemeTransition>,
    pub opening_screen: Option<OpeningScreen>,
    pub widget_unroll: Option<WidgetUnroll>,
    pub widget_spring: Option<Elasticity>,
    pub island_passage: Option<IslandPassage>,
    pub card_hover: Option<CardHoverStyle>,
    pub bokeh: Option<bool>,
    pub particles: Option<bool>,
    pub cursor_light: Option<bool>,
    pub color_intensity: Option<ColorIntensity>,
    pub color_character: Option<ColorCharacter>,
    pub color_pick: Option<ColorPick>,
    pub color_passage: Option<ColorPassage>,
    pub color_trigger: Option<ColorTrigger>,
    pub color_from_icon: Option<bool>,
    pub sounds_on: Option<bool>,
    pub sound_pack: Option<SoundPack>,
    pub sound_volume: Option<f32>,
    pub sound_interface: Option<bool>,
    pub sound_transitions: Option<bool>,
    pub sound_launch: Option<bool>,
    pub update_auto: Option<bool>,
    pub startup_home: Option<bool>,
    pub ignored_detections: Option<Vec<String>>,
}

impl Settings {
    pub fn apply(&mut self, patch: SettingsPatch) {
        macro_rules! take {
            ($($field:ident),* $(,)?) => {
                $(if let Some(v) = patch.$field {
                    self.$field = v;
                })*
            };
        }
        take!(
            theme_id,
            quality,
            color_mode,
            hotkey,
            language,
            atmosphere_intensity,
            display_mode,
            hide_on_escape,
            hide_on_blur,
            economy_mode,
            motion_style,
            follow_system_motion,
            card_float,
            opening_style,
            theme_transition,
            opening_screen,
            widget_unroll,
            widget_spring,
            island_passage,
            card_hover,
            bokeh,
            particles,
            cursor_light,
            color_intensity,
            color_character,
            color_pick,
            color_passage,
            color_trigger,
            color_from_icon,
            sounds_on,
            sound_pack,
            sound_volume,
            sound_interface,
            sound_transitions,
            sound_launch,
            update_auto,
            startup_home,
            ignored_detections,
        );
    }
}

/// v1 → v2 (R5): Mauve became Encre, the five pre-logo themes fall back to Bleu-gris.
pub const SETTINGS_MIGRATIONS: &[Migration] = &[settings_v1_to_v2];

impl Document for Settings {
    const NAME: &'static str = "settings.json";
    const MIGRATIONS: &'static [Migration] = SETTINGS_MIGRATIONS;
    fn from_value(value: Value, report: &mut LoadReport) -> Result<Self, String> {
        Ok(lenient_merge(value, report, |s: &Settings| {
            validate_settings(s).map_err(|e| e.to_string())
        }))
    }
}

/// Slot name → app id. Shared scenes only ever mention slot names, never paths or commands.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SlotsFile {
    pub schema_version: u32,
    pub slots: BTreeMap<String, String>,
}

impl Default for SlotsFile {
    fn default() -> Self {
        Self {
            schema_version: 1,
            slots: BTreeMap::new(),
        }
    }
}

impl Document for SlotsFile {
    const NAME: &'static str = "slots.json";
    fn from_value(value: Value, report: &mut LoadReport) -> Result<Self, String> {
        Ok(lenient_merge(value, report, |_: &SlotsFile| Ok(())))
    }
}

/// Shared / imported files are strict: any unknown field rejects the whole file.
pub trait StrictFile: serde::de::DeserializeOwned {
    fn check(&self) -> Result<(), String>;
}

/// Colour theme file (`themes/<id>.json`), same shape as `src/design/theme.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThemeFile {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    pub bg: [String; 3],
    pub accent: String,
    pub glow: String,
    pub fog: [String; 3],
    pub card: [u8; 3],
    pub beam: [u8; 3],
    /// The two colours of the gradient, A and B (logo themes, personal themes).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gradient: Option<[String; 2]>,
    /// Soft text colour (labels).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub soft: Option<String>,
}

/// `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, or `rgb(…)` / `rgba(…)` with numbers only: a theme
/// colour ends up in a CSS variable, so nothing else (no `url(…)`, no `;`) may get through.
pub fn is_theme_colour(s: &str) -> bool {
    if let Some(hex) = s.strip_prefix('#') {
        return matches!(hex.len(), 3 | 4 | 6 | 8) && hex.bytes().all(|b| b.is_ascii_hexdigit());
    }
    let inner = s
        .strip_prefix("rgba(")
        .or_else(|| s.strip_prefix("rgb("))
        .and_then(|r| r.strip_suffix(')'));
    inner.is_some_and(|r| {
        s.len() <= 48
            && r.bytes()
                .all(|b| b.is_ascii_digit() || matches!(b, b'.' | b',' | b' ' | b'%'))
    })
}

fn check_header(version: u32, id: &str, name: &str) -> Result<(), String> {
    if version != 1 {
        return Err(format!("unsupported schemaVersion {version}"));
    }
    super::validate::validate_id(id).map_err(|e| e.to_string())?;
    if name.is_empty() || name.chars().count() > 200 {
        return Err("name must be 1–200 characters".into());
    }
    Ok(())
}

impl StrictFile for ThemeFile {
    fn check(&self) -> Result<(), String> {
        check_header(self.schema_version, &self.id, &self.name)?;
        for (field, text) in [("author", &self.author), ("description", &self.description)] {
            if text.is_empty() || text.chars().count() > 200 {
                return Err(format!("{field} must be 1–200 characters"));
            }
        }
        let colours = self
            .bg
            .iter()
            .chain(&self.fog)
            .chain([&self.accent, &self.glow])
            .chain(self.gradient.iter().flatten())
            .chain(&self.soft);
        for c in colours {
            if !is_theme_colour(c) {
                return Err(format!("invalid colour «{c}»"));
            }
        }
        Ok(())
    }
}
