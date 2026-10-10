//! What the interface remembers between runs without it being a preference: where each display
//! mode last was, and the apps launched most recently (`state.json`).

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::store::{lenient_merge, Document, LoadReport};

/// Apps kept in the « récents » list.
pub const MAX_RECENTS: usize = 8;

/// Rectangle in physical pixels, in virtual-desktop coordinates.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// A screen as last seen: Windows' name for it (stable while the setup does not change) and its
/// rectangle, to find it again after a re-plug.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct MonitorKey {
    pub name: Option<String>,
    pub rect: Rect,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Placement {
    pub monitor: Option<MonitorKey>,
    /// Outer rectangle of the window; ignored by the immersive mode (the screen decides).
    pub rect: Option<Rect>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UiState {
    pub schema_version: u32,
    pub immersive: Placement,
    pub window: Placement,
    pub widget: Placement,
    /// Most recent first, at most [`MAX_RECENTS`].
    pub recents: Vec<String>,
}

impl Default for UiState {
    fn default() -> Self {
        Self {
            schema_version: 1,
            immersive: Placement::default(),
            window: Placement::default(),
            widget: Placement::default(),
            recents: Vec::new(),
        }
    }
}

impl UiState {
    /// Puts `id` first, drops a previous occurrence and anything beyond the limit.
    /// Returns false when the list did not change.
    pub fn push_recent(&mut self, id: &str) -> bool {
        if self.recents.first().map(String::as_str) == Some(id) {
            return false;
        }
        self.recents.retain(|r| r != id);
        self.recents.insert(0, id.to_string());
        self.recents.truncate(MAX_RECENTS);
        true
    }
}

impl Document for UiState {
    const NAME: &'static str = "state.json";
    fn from_value(value: Value, report: &mut LoadReport) -> Result<Self, String> {
        let mut state: UiState = lenient_merge(value, report, |_: &UiState| Ok(()));
        // Ids are only ever compared with the app list: drop junk, keep the order.
        state
            .recents
            .retain(|r| super::validate::validate_id(r).is_ok());
        state.recents.truncate(MAX_RECENTS);
        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load(json: &str) -> UiState {
        let mut report = LoadReport::default();
        UiState::from_value(serde_json::from_str(json).unwrap(), &mut report).unwrap()
    }

    #[test]
    fn recents_are_unique_most_recent_first_and_capped() {
        let mut s = UiState::default();
        for id in ["a", "b", "c", "a"] {
            s.push_recent(id);
        }
        assert_eq!(s.recents, ["a", "c", "b"]);
        assert!(!s.push_recent("a"), "same first entry: nothing changes");
        for n in 0..20 {
            s.push_recent(&format!("app-{n}"));
        }
        assert_eq!(s.recents.len(), MAX_RECENTS);
        assert_eq!(s.recents[0], "app-19");
    }

    #[test]
    fn a_partial_or_odd_file_still_loads() {
        let s = load(r#"{"schemaVersion":1,"recents":["ok","Not Valid","fine"],"surprise":1}"#);
        assert_eq!(s.recents, ["ok", "fine"]);
        assert_eq!(s.window, Placement::default());
        // A placement with a wrong type is replaced by its default; the rest is kept.
        let s = load(r#"{"schemaVersion":1,"widget":"nope","recents":["x"]}"#);
        assert_eq!(s.widget, Placement::default());
        assert_eq!(s.recents, ["x"]);
    }

    #[test]
    fn placements_round_trip() {
        let mut s = UiState::default();
        s.window.rect = Some(Rect {
            x: -2560,
            y: 40,
            width: 1280,
            height: 760,
        });
        s.window.monitor = Some(MonitorKey {
            name: Some("DISPLAY2".into()),
            rect: Rect {
                x: -2560,
                y: 0,
                width: 2560,
                height: 1440,
            },
        });
        let back = load(&serde_json::to_string(&s).unwrap());
        assert_eq!(back, s);
    }
}
