//! Game ambiences, `.hubmood` files (steps 16–17): declarative layers drawn by the atmosphere
//! (particles, a ring of glyphs, mist, beams, a pulse of light). Never any code: a file that does
//! not fit this schema exactly is refused. The built-in packs live in the page
//! (`src/fx/mood/packs.ts`); the user's imported ones in `moods/<id>.hubmood`, ids `perso-…`.
//! Glyphs are SVG path data restricted to numbers and path commands (no `url(`, no markup).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::schema::StrictFile;
use super::validate::validate_id;

pub const MAX_LAYERS: usize = 6;
pub const MAX_GLYPHS: usize = 8;
pub const MAX_PATH_CHARS: usize = 1500;
/// A path holds at most this many numbers (a little over 100 curves).
const MAX_PATH_NUMBERS: usize = 600;

/// What a layer's colour is taken from: the game's colours (or the theme's), never a free value.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ColorRole {
    /// Colour A (the strongest of the picture, or the theme's first).
    Dominant,
    /// Colour B.
    Accent,
    /// The night (background).
    Dark,
    /// The text colour (near white).
    Text,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ParticleShape {
    Ember,
    Dot,
    Star,
    Line,
    Glyph,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
    None,
}

/// One layer of an ambience. Sizes in px, speeds in px/s, lives and periods in s, opacities 0–1.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum MoodLayer {
    /// Particles spread over the scene (`count` at « Élevé »); `drift`: sideways sway 0–1.
    Particles {
        shape: ParticleShape,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[specta(optional)]
        glyph: Option<String>,
        count: u32,
        size: [f32; 2],
        speed: [f32; 2],
        direction: Direction,
        drift: f32,
        life: [f32; 2],
        color_role: ColorRole,
        opacity: f32,
    },
    /// Glyphs on a circle around the shown card (radius × the screen's height), turning in °/s.
    GlyphRing {
        glyph: String,
        count: u32,
        radius: f32,
        rotation: f32,
        size: f32,
        color_role: ColorRole,
        opacity: f32,
    },
    /// Large soft clouds drifting low across the scene.
    Mist {
        count: u32,
        color_role: ColorRole,
        opacity: f32,
        speed: f32,
    },
    /// Columns of light from the top, swaying by `sway` degrees.
    Beam {
        count: u32,
        sway: f32,
        color_role: ColorRole,
        opacity: f32,
    },
    /// A ring of light breathing around the shown card.
    Pulse {
        period: f32,
        color_role: ColorRole,
        opacity: f32,
    },
}

/// A short sequence played before the game starts (30/10): only these, drawn by Kayro itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum LaunchStyle {
    /// A witch's seal traced and set alight around the card, which burns into it (Hades II).
    Seal,
    /// A painted night, a far monolith, petals; the card erased into petals (Clair Obscur).
    Gommage,
}

/// A `.hubmood` file.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MoodFile {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    /// The game it was made for (shown, never used to pick anything).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[specta(optional)]
    pub game_hint: Option<String>,
    #[serde(default)]
    pub glyphs: BTreeMap<String, String>,
    pub layers: Vec<MoodLayer>,
    /// Played when the game is launched from its card (30/10); absent = it starts at once.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[specta(optional)]
    pub launch: Option<LaunchStyle>,
}

/// The user's dosage of an app's ambience (Modifier › Apparence): density and speed, × 0.25–2.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MoodTune {
    pub density: f32,
    pub speed: f32,
}

pub fn validate_tune(t: &MoodTune) -> Result<(), String> {
    within("density", t.density, 0.25, 2.0)?;
    within("speed", t.speed, 0.25, 2.0)
}

fn within(field: &str, v: f32, lo: f32, hi: f32) -> Result<(), String> {
    if v.is_finite() && (lo..=hi).contains(&v) {
        Ok(())
    } else {
        Err(format!("{field} must be within {lo}–{hi}"))
    }
}

fn range(field: &str, r: [f32; 2], lo: f32, hi: f32) -> Result<(), String> {
    within(field, r[0], lo, hi)?;
    within(field, r[1], lo, hi)?;
    if r[0] > r[1] {
        return Err(format!(
            "{field}: the first value must not exceed the second"
        ));
    }
    Ok(())
}

fn count(field: &str, n: u32, max: u32) -> Result<(), String> {
    if (1..=max).contains(&n) {
        Ok(())
    } else {
        Err(format!("{field} must be within 1–{max}"))
    }
}

/// SVG path data, sanitised: path commands, numbers, separators; it must start with a move.
pub fn check_path(d: &str) -> Result<(), String> {
    if d.is_empty() || d.chars().count() > MAX_PATH_CHARS {
        return Err(format!(
            "a glyph path must be 1–{MAX_PATH_CHARS} characters"
        ));
    }
    let allowed = |c: char| "MmLlHhVvCcSsQqTtAaZz0123456789.-+eE, ".contains(c) || c == '\n';
    if let Some(c) = d.chars().find(|&c| !allowed(c)) {
        return Err(format!("character «{c}» not allowed in a glyph path"));
    }
    if !d.trim_start().starts_with(['M', 'm']) {
        return Err("a glyph path starts with M".into());
    }
    let numbers = d
        .split(|c: char| !(c.is_ascii_digit() || c == '.'))
        .filter(|s| !s.is_empty())
        .count();
    if numbers > MAX_PATH_NUMBERS {
        return Err("glyph path too long".into());
    }
    Ok(())
}

impl MoodFile {
    fn glyph(&self, name: &Option<String>, needed: bool) -> Result<(), String> {
        match name {
            Some(g) if self.glyphs.contains_key(g) => Ok(()),
            Some(g) => Err(format!("unknown glyph «{g}»")),
            None if needed => Err("this layer needs a glyph".into()),
            None => Ok(()),
        }
    }
}

impl StrictFile for MoodFile {
    fn check(&self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err(format!("unsupported schemaVersion {}", self.schema_version));
        }
        validate_id(&self.id).map_err(|e| e.to_string())?;
        if self.name.trim().is_empty() || self.name.chars().count() > 80 {
            return Err("name must be 1–80 characters".into());
        }
        if self
            .game_hint
            .as_ref()
            .is_some_and(|h| h.chars().count() > 80)
        {
            return Err("gameHint must be at most 80 characters".into());
        }
        if self.glyphs.len() > MAX_GLYPHS {
            return Err(format!("at most {MAX_GLYPHS} glyphs"));
        }
        for (name, d) in &self.glyphs {
            validate_id(name).map_err(|_| format!("invalid glyph name «{name}»"))?;
            check_path(d)?;
        }
        if self.layers.is_empty() || self.layers.len() > MAX_LAYERS {
            return Err(format!("1–{MAX_LAYERS} layers"));
        }
        for layer in &self.layers {
            self.check_layer(layer)?;
        }
        Ok(())
    }
}

impl MoodFile {
    fn check_layer(&self, layer: &MoodLayer) -> Result<(), String> {
        match layer {
            MoodLayer::Particles {
                shape,
                glyph,
                count: n,
                size,
                speed,
                drift,
                life,
                opacity,
                ..
            } => {
                count("count", *n, 80)?;
                range("size", *size, 0.5, 60.0)?;
                range("speed", *speed, 0.0, 400.0)?;
                range("life", *life, 0.5, 60.0)?;
                within("drift", *drift, 0.0, 1.0)?;
                within("opacity", *opacity, 0.0, 1.0)?;
                self.glyph(glyph, *shape == ParticleShape::Glyph)
            }
            MoodLayer::GlyphRing {
                glyph,
                count: n,
                radius,
                rotation,
                size,
                opacity,
                ..
            } => {
                count("count", *n, 24)?;
                within("radius", *radius, 0.1, 0.6)?;
                within("rotation", *rotation, -90.0, 90.0)?;
                within("size", *size, 4.0, 80.0)?;
                within("opacity", *opacity, 0.0, 1.0)?;
                self.glyph(&Some(glyph.clone()), true)
            }
            MoodLayer::Mist {
                count: n,
                opacity,
                speed,
                ..
            } => {
                count("count", *n, 6)?;
                within("opacity", *opacity, 0.0, 0.6)?;
                within("speed", *speed, 0.0, 60.0)
            }
            MoodLayer::Beam {
                count: n,
                sway,
                opacity,
                ..
            } => {
                count("count", *n, 4)?;
                within("sway", *sway, 0.0, 20.0)?;
                within("opacity", *opacity, 0.0, 1.0)
            }
            MoodLayer::Pulse {
                period, opacity, ..
            } => {
                within("period", *period, 1.0, 20.0)?;
                within("opacity", *opacity, 0.0, 1.0)
            }
        }
    }
}

#[cfg(test)]
#[path = "moods_tests.rs"]
mod tests;
