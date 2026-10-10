//! Typed shape of the small documents: settings, slots, and the shared (strict) files
//! scenes and themes. Apps live in `apps.rs`.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

pub use super::scene::SceneFile;
use super::store::{lenient_merge, Document, LoadReport};
use super::validate::validate_settings;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
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

/// Look of the widget bar (reference/Widget.dc.html); provisional until the art direction is frozen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum WidgetStyle {
    Aurore,
    Sillage,
    #[default]
    Brume,
    Orbe,
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
    /// Strength of the animated atmosphere (fog, light, dust), 0.3–1 (DESIGN.md « intensité »).
    pub atmosphere_intensity: f32,
    pub display_mode: DisplayMode,
    pub widget_style: WidgetStyle,
    /// Escape hides the hub once there is nothing left to close.
    pub hide_on_escape: bool,
    /// Losing the focus hides the hub (the widget only folds its panel).
    pub hide_on_blur: bool,
    /// « Mode économe »: the window is destroyed while hidden (less memory, slower to come back).
    pub economy_mode: bool,
}

/// Bounds of [`Settings::atmosphere_intensity`].
pub const ATMOSPHERE_MIN: f32 = 0.3;
pub const ATMOSPHERE_MAX: f32 = 1.0;

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            theme_id: "crepuscule".into(),
            quality: Quality::default(),
            color_mode: ColorMode::default(),
            hotkey: "Ctrl+Alt+H".into(),
            language: "fr".into(),
            atmosphere_intensity: ATMOSPHERE_MAX,
            display_mode: DisplayMode::default(),
            widget_style: WidgetStyle::default(),
            hide_on_escape: true,
            hide_on_blur: false,
            economy_mode: false,
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
    pub widget_style: Option<WidgetStyle>,
    pub hide_on_escape: Option<bool>,
    pub hide_on_blur: Option<bool>,
    pub economy_mode: Option<bool>,
}

impl Settings {
    pub fn apply(&mut self, patch: SettingsPatch) {
        if let Some(v) = patch.theme_id {
            self.theme_id = v;
        }
        if let Some(v) = patch.quality {
            self.quality = v;
        }
        if let Some(v) = patch.color_mode {
            self.color_mode = v;
        }
        if let Some(v) = patch.hotkey {
            self.hotkey = v;
        }
        if let Some(v) = patch.language {
            self.language = v;
        }
        if let Some(v) = patch.atmosphere_intensity {
            self.atmosphere_intensity = v;
        }
        if let Some(v) = patch.display_mode {
            self.display_mode = v;
        }
        if let Some(v) = patch.widget_style {
            self.widget_style = v;
        }
        if let Some(v) = patch.hide_on_escape {
            self.hide_on_escape = v;
        }
        if let Some(v) = patch.hide_on_blur {
            self.hide_on_blur = v;
        }
        if let Some(v) = patch.economy_mode {
            self.economy_mode = v;
        }
    }
}

impl Document for Settings {
    const NAME: &'static str = "settings.json";
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
