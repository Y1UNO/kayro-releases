//! Scene files (`scenes/<id>.json`): a list of steps that only ever name *slots*, never a path
//! or a command (CLAUDE.md « Sécurité »). Strict: an unknown field or step type rejects the file.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::schema::StrictFile;
use super::validate::validate_id;

pub const MAX_STEPS: usize = 200;
/// Longest single `wait` or `waitReady` timeout.
pub const MAX_DELAY_MS: u32 = 10 * 60 * 1000;
const MAX_HOTKEY: usize = 40;

/// One step. `required`: if it fails, the rest of the scene is not run.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Step {
    Launch {
        slot: String,
        #[serde(default)]
        required: bool,
    },
    Wait {
        ms: u32,
        #[serde(default)]
        required: bool,
    },
    WaitReady {
        slot: String,
        timeout_ms: u32,
        #[serde(default)]
        required: bool,
    },
    Focus {
        slot: String,
        #[serde(default)]
        required: bool,
    },
    /// Soft close only (a close message to the window); the interface confirms first.
    Close {
        slot: String,
        #[serde(default)]
        required: bool,
    },
}

impl Step {
    pub fn required(&self) -> bool {
        match self {
            Self::Launch { required, .. }
            | Self::Wait { required, .. }
            | Self::WaitReady { required, .. }
            | Self::Focus { required, .. }
            | Self::Close { required, .. } => *required,
        }
    }

    pub fn kind(&self) -> &'static str {
        match self {
            Self::Launch { .. } => "launch",
            Self::Wait { .. } => "wait",
            Self::WaitReady { .. } => "waitReady",
            Self::Focus { .. } => "focus",
            Self::Close { .. } => "close",
        }
    }

    fn check(&self) -> Result<(), String> {
        match self {
            Self::Wait { ms, .. } if *ms > MAX_DELAY_MS => {
                Err(format!("wait over {MAX_DELAY_MS} ms"))
            }
            Self::WaitReady { timeout_ms, .. } if !(1..=MAX_DELAY_MS).contains(timeout_ms) => {
                Err(format!("timeoutMs must be 1–{MAX_DELAY_MS}"))
            }
            Self::Launch { slot, .. }
            | Self::WaitReady { slot, .. }
            | Self::Focus { slot, .. }
            | Self::Close { slot, .. } => {
                validate_id(slot).map_err(|_| format!("bad slot name «{slot}»"))
            }
            Self::Wait { .. } => Ok(()),
        }
    }
}

/// `scenes/<id>.json`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SceneFile {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    /// Accepted and kept; binding it to a global shortcut comes with the scene editor.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hotkey: Option<String>,
    pub steps: Vec<Step>,
}

impl StrictFile for SceneFile {
    fn check(&self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err(format!("unsupported schemaVersion {}", self.schema_version));
        }
        validate_id(&self.id).map_err(|e| e.to_string())?;
        if self.name.is_empty() || self.name.chars().count() > 200 {
            return Err("name must be 1–200 characters".into());
        }
        if self.hotkey.as_ref().is_some_and(|h| h.len() > MAX_HOTKEY) {
            return Err("hotkey too long".into());
        }
        if self.steps.len() > MAX_STEPS {
            return Err("too many steps".into());
        }
        self.steps
            .iter()
            .enumerate()
            .try_for_each(|(i, s)| s.check().map_err(|e| format!("step {}: {e}", i + 1)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn parse(v: serde_json::Value) -> Result<SceneFile, String> {
        let scene: SceneFile = serde_json::from_value(v).map_err(|e| e.to_string())?;
        scene.check()?;
        Ok(scene)
    }

    #[test]
    fn architecture_example_round_trips() {
        let scene = parse(json!({
            "schemaVersion": 1, "id": "soiree-gaming", "name": "Soirée gaming", "hotkey": "Ctrl+Alt+1",
            "steps": [
                { "type": "launch", "slot": "messagerie" },
                { "type": "wait", "ms": 2000 },
                { "type": "waitReady", "slot": "plateforme-jeux", "timeoutMs": 30000, "required": true },
                { "type": "focus", "slot": "musique" },
                { "type": "close", "slot": "messagerie" }
            ]
        }))
        .unwrap();
        assert_eq!(scene.steps.len(), 5);
        assert!(scene.steps[2].required() && !scene.steps[0].required());
        let again: SceneFile =
            serde_json::from_str(&serde_json::to_string(&scene).unwrap()).unwrap();
        assert_eq!(again, scene);
    }

    #[test]
    fn unknown_types_fields_and_bad_values_are_rejected() {
        let base =
            |step: serde_json::Value| json!({"schemaVersion":1,"id":"s","name":"S","steps":[step]});
        for bad in [
            json!({"type":"run","slot":"a"}),
            json!({"type":"launch","slot":"a","command":"calc"}),
            json!({"type":"launch","slot":"C:\\x.exe"}),
            json!({"type":"launch"}),
            json!({"type":"waitReady","slot":"a","timeoutMs":0}),
            json!({"type":"wait","ms": MAX_DELAY_MS + 1}),
        ] {
            assert!(parse(base(bad.clone())).is_err(), "{bad}");
        }
        let mut many = base(json!({"type":"wait","ms":1}));
        many["steps"] = json!(vec![json!({"type":"wait","ms":1}); MAX_STEPS + 1]);
        assert!(parse(many).is_err());
    }
}
