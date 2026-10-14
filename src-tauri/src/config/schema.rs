//! Typed shape of the small documents: settings, slots, and the shared (strict) files
//! scenes and themes. Apps live in `apps.rs`.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

use super::migrate::{current_version, Migration};
pub use super::scene::SceneFile;
use super::store::{lenient_merge, Document, LoadReport};
use super::validate::validate_settings;
use super::visual::{settings_v1_to_v2, DEFAULT_THEME};
pub use super::visual::{
    CardFloat, CardHoverStyle, Elasticity, MotionStyle, OpeningStyle, ThemeTransition, WidgetUnroll,
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
    #[default]
    Light,
    Immersive,
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
    pub widget_unroll: WidgetUnroll,
    pub widget_spring: Elasticity,
    pub card_hover: CardHoverStyle,
    pub bokeh: bool,
    pub particles: bool,
    pub cursor_light: bool,
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
            widget_unroll: WidgetUnroll::default(),
            widget_spring: Elasticity::default(),
            card_hover: CardHoverStyle::default(),
            bokeh: true,
            particles: true,
            cursor_light: true,
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
    pub widget_unroll: Option<WidgetUnroll>,
    pub widget_spring: Option<Elasticity>,
    pub card_hover: Option<CardHoverStyle>,
    pub bokeh: Option<bool>,
    pub particles: Option<bool>,
    pub cursor_light: Option<bool>,
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
            widget_unroll,
            widget_spring,
            card_hover,
            bokeh,
            particles,
            cursor_light,
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
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
        check_header(self.schema_version, &self.id, &self.name)
    }
}
