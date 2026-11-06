//! The colour theme file (`themes/<id>.json`), strict: moved out of `schema.rs` (2026-11-02).

use serde::{Deserialize, Serialize};

use super::schema::StrictFile;

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
