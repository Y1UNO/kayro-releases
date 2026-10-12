//! Choices of the « Visuel » settings (R5): each one picks a variant of the art direction.
//! The defaults are the validated look; the page maps them onto the art-direction values.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

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

/// « Dépliage du widget ».
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum WidgetUnroll {
    #[default]
    Unroll,
    Sober,
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
