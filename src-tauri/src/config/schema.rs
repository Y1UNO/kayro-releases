//! Typed shape of the small documents: settings, slots, and the shared (strict) files
//! scenes and themes. Apps live in `apps.rs`.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub schema_version: u32,
    pub theme_id: String,
    pub quality: Quality,
    pub color_mode: ColorMode,
    pub hotkey: String,
    pub language: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            theme_id: "crepuscule".into(),
            quality: Quality::default(),
            color_mode: ColorMode::default(),
            hotkey: "Ctrl+Alt+H".into(),
            language: "fr".into(),
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

/// Minimal scene (`scenes/<id>.json`); the step list arrives with the scene engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SceneFile {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub steps: Vec<Value>,
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

impl StrictFile for SceneFile {
    fn check(&self) -> Result<(), String> {
        check_header(self.schema_version, &self.id, &self.name)?;
        if self.steps.len() > 200 {
            return Err("too many steps".into());
        }
        Ok(())
    }
}

impl StrictFile for ThemeFile {
    fn check(&self) -> Result<(), String> {
        check_header(self.schema_version, &self.id, &self.name)
    }
}
