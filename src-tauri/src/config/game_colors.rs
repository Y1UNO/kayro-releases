//! Choices of the game colours (step 14, « Personnalisation avancée » and the app's own choice).
//! Defaults = the decisions of the step-14 board (DA-JOURNAL, 2026-10-14).

use serde::{Deserialize, Serialize};
use specta::Type;

/// Share of the game's colours mixed into the theme (V1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ColorIntensity {
    Soft,
    #[default]
    Normal,
    Strong,
}

/// Bounds of lightness and chroma (V6): like the themes', faithful to the picture, or vivid.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ColorCharacter {
    #[default]
    Theme,
    Faithful,
    Vivid,
}

/// Which colours become A and B (V5): dominant → accent, the two most vivid, dominant → theme B.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ColorPick {
    #[default]
    Dominant,
    Vivid,
    Theme,
}

/// How the colours go from one game to the next (V7): the tide, a fade, or at once.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ColorPassage {
    #[default]
    Tide,
    Fade,
    Direct,
}

/// When the colours change (V8): once the selection rests, at once, or only when an app starts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ColorTrigger {
    #[default]
    Select,
    Instant,
    Launch,
}

/// The colours of one app, chosen by the user in its edit dialog. Absent = automatic.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum AppColors {
    /// The palette of the app's images.
    Auto,
    /// Two colours picked among the palette's (`#rrggbb`), used as A and B.
    Chosen { a: String, b: String },
    /// Never tinted: the theme's colours.
    Theme,
}

fn is_hex(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].bytes().all(|b| b.is_ascii_hexdigit())
}

/// Chosen colours must be plain `#rrggbb` (they are written into CSS).
pub fn validate_app_colors(c: &AppColors) -> Result<(), String> {
    match c {
        AppColors::Chosen { a, b } if !is_hex(a) || !is_hex(b) => {
            Err("colours must be #rrggbb".into())
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chosen_colours_are_plain_hex() {
        let ok = AppColors::Chosen {
            a: "#1d342f".into(),
            b: "#89B08E".into(),
        };
        assert!(validate_app_colors(&ok).is_ok());
        for bad in ["red", "#12345", "#1234567", "#12345g", "url(x)", ""] {
            let c = AppColors::Chosen {
                a: bad.into(),
                b: "#000000".into(),
            };
            assert!(validate_app_colors(&c).is_err(), "{bad}");
        }
        assert!(validate_app_colors(&AppColors::Theme).is_ok());
    }

    #[test]
    fn app_colours_read_and_write_with_their_mode() {
        let c: AppColors =
            serde_json::from_str(r##"{"mode":"chosen","a":"#000000","b":"#ffffff"}"##).unwrap();
        assert!(matches!(c, AppColors::Chosen { .. }));
        assert_eq!(
            serde_json::to_string(&AppColors::Theme).unwrap(),
            r#"{"mode":"theme"}"#
        );
    }
}
