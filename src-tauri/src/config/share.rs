//! `.hubscene` files: a scene made to be shared. It carries step types and *slot names* only —
//! never a path, a command or an app (CLAUDE.md « Sécurité »). Importing is strict: any unknown
//! field, any limit exceeded, rejects the whole file; the importer then links each slot to one
//! of the user's own apps.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::atomic::write_atomic;
use super::scene::{check_name, SceneFile, Step, MAX_STEPS};
use super::validate::validate_id;

pub const EXTENSION: &str = "hubscene";
const FORMAT: &str = "hubscene";
/// A scene of 200 steps is about 20 KiB: this is generous and stops giant files early.
pub const MAX_FILE_BYTES: u64 = 256 * 1024;
const MAX_SLOTS: usize = 50;

/// The shared file. `slots` lists every slot the steps use, so the importer can ask for them.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HubSceneFile {
    pub format: String,
    pub schema_version: u32,
    pub name: String,
    pub slots: Vec<String>,
    pub steps: Vec<Step>,
}

impl HubSceneFile {
    pub fn check(&self) -> Result<(), String> {
        if self.format != FORMAT {
            return Err("not a .hubscene file".into());
        }
        if self.schema_version != 1 {
            return Err(format!("unsupported schemaVersion {}", self.schema_version));
        }
        check_name(&self.name)?;
        if self.slots.len() > MAX_SLOTS {
            return Err("too many slots".into());
        }
        let mut seen = BTreeSet::new();
        for slot in &self.slots {
            validate_id(slot).map_err(|_| format!("bad slot name «{}»", clip(slot)))?;
            if !seen.insert(slot.as_str()) {
                return Err(format!("slot «{slot}» listed twice"));
            }
        }
        if self.steps.len() > MAX_STEPS {
            return Err("too many steps".into());
        }
        for (i, step) in self.steps.iter().enumerate() {
            step.check().map_err(|e| format!("step {}: {e}", i + 1))?;
            if step.slot().is_some_and(|s| !seen.contains(s)) {
                return Err(format!("step {}: slot missing from the slot list", i + 1));
            }
        }
        Ok(())
    }
}

/// Error messages never echo more than a short, printable part of a hostile value.
fn clip(text: &str) -> String {
    text.chars().filter(|c| !c.is_control()).take(40).collect()
}

/// Parses and validates the content of a `.hubscene` file.
pub fn parse(bytes: &[u8]) -> Result<HubSceneFile, String> {
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("file too large".into());
    }
    // `serde_json` stops at a nesting depth of 128: a deeply nested file is an error, not a crash.
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    let file: HubSceneFile = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    file.check()?;
    Ok(file)
}

/// Reads a `.hubscene` file the user picked. Looks at its name and size before opening it.
pub fn read(path: &Path) -> Result<HubSceneFile, String> {
    let is_scene = path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case(EXTENSION));
    if !is_scene {
        return Err("not a .hubscene file".into());
    }
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if !meta.is_file() || meta.len() > MAX_FILE_BYTES {
        return Err("not a regular file, or too large".into());
    }
    parse(&fs::read(path).map_err(|e| e.to_string())?)
}

/// What a scene looks like once stripped for sharing: no id, no shortcut, slot names only.
pub fn export(scene: &SceneFile) -> HubSceneFile {
    let mut slots: Vec<String> = Vec::new();
    for slot in scene.steps.iter().filter_map(Step::slot) {
        if !slots.iter().any(|s| s == slot) {
            slots.push(slot.to_string());
        }
    }
    HubSceneFile {
        format: FORMAT.into(),
        schema_version: 1,
        name: scene.name.clone(),
        slots,
        steps: scene.steps.clone(),
    }
}

/// Writes `<id>.hubscene` in `dir` (never over an earlier export: `-2`, `-3`… is appended).
pub fn write_export(dir: &Path, scene: &SceneFile) -> std::io::Result<PathBuf> {
    let mut bytes = serde_json::to_vec_pretty(&export(scene)).map_err(std::io::Error::other)?;
    bytes.push(b'\n');
    let mut path = dir.join(format!("{}.{EXTENSION}", scene.id));
    for n in 2u32.. {
        if !path.exists() {
            break;
        }
        path = dir.join(format!("{}-{n}.{EXTENSION}", scene.id));
    }
    write_atomic(&path, &bytes)?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn good() -> Value {
        json!({
            "format": "hubscene", "schemaVersion": 1, "name": "Soirée gaming",
            "slots": ["messagerie", "plateforme-jeux"],
            "steps": [
                { "type": "launch", "slot": "messagerie" },
                { "type": "wait", "ms": 2000 },
                { "type": "launch", "slot": "plateforme-jeux" },
                { "type": "waitReady", "slot": "plateforme-jeux", "timeoutMs": 30000 }
            ]
        })
    }

    fn parse_value(v: &Value) -> Result<HubSceneFile, String> {
        parse(v.to_string().as_bytes())
    }

    fn with(key: &str, value: Value) -> Value {
        let mut v = good();
        v[key] = value;
        v
    }

    #[test]
    fn a_good_file_parses() {
        let file = parse_value(&good()).unwrap();
        assert_eq!(file.steps.len(), 4);
        assert_eq!(file.slots, ["messagerie", "plateforme-jeux"]);
    }

    #[test]
    fn export_keeps_slot_names_only_and_round_trips() {
        let scene: SceneFile = serde_json::from_value(json!({
            "schemaVersion": 1, "id": "soiree", "name": "Soirée", "hotkey": "Ctrl+Alt+1",
            "steps": [
                { "type": "launch", "slot": "b" }, { "type": "wait", "ms": 5 },
                { "type": "focus", "slot": "a", "required": true }, { "type": "close", "slot": "b" }
            ]
        }))
        .unwrap();
        let file = export(&scene);
        assert_eq!(file.slots, ["b", "a"]);
        let text = serde_json::to_string(&file).unwrap();
        assert!(!text.contains("hotkey") && !text.contains("soiree") && !text.contains("path"));
        assert_eq!(parse(text.as_bytes()).unwrap(), file);
    }

    #[test]
    fn paths_commands_and_unknown_fields_are_rejected() {
        let step = |s: Value| with("steps", json!([s]));
        for bad in [
            // A slot is a name, never a path.
            json!({ "type": "launch", "slot": "C:\\Windows\\System32\\cmd.exe" }),
            json!({ "type": "launch", "slot": "..\\..\\evil" }),
            json!({ "type": "launch", "slot": "a/b" }),
            // No command, path or argument field on a step.
            json!({ "type": "launch", "slot": "messagerie", "command": "calc.exe" }),
            json!({ "type": "launch", "slot": "messagerie", "path": "C:\\x.exe" }),
            json!({ "type": "run", "command": "powershell -c whoami" }),
            json!({ "type": "launch", "app": "discord" }),
        ] {
            assert!(parse_value(&step(bad.clone())).is_err(), "{bad}");
        }
        for key in ["command", "path", "exe", "apps", "hotkey", "id", "script"] {
            let mut v = good();
            v[key] = json!("x");
            assert!(parse_value(&v).is_err(), "top-level {key}");
        }
        // The slot list must be honest: a name used by a step has to be listed, and vice versa
        // is harmless, but a path in the list is not.
        assert!(parse_value(&with("slots", json!(["messagerie"]))).is_err());
        assert!(parse_value(&with(
            "slots",
            json!(["a", "a", "plateforme-jeux", "messagerie"])
        ))
        .is_err());
        assert!(parse_value(&with(
            "slots",
            json!(["C:\\x.exe", "plateforme-jeux", "messagerie"])
        ))
        .is_err());
    }

    #[test]
    fn wrong_format_version_and_values_are_rejected() {
        assert!(parse_value(&with("format", json!("hubmood"))).is_err());
        assert!(parse_value(&with("schemaVersion", json!(2))).is_err());
        assert!(parse_value(&with("name", json!(""))).is_err());
        assert!(parse_value(&with("name", json!("a\u{7}b"))).is_err());
        assert!(parse_value(&with("name", json!("x".repeat(201)))).is_err());
        assert!(parse_value(&with(
            "steps",
            json!([{ "type": "wait", "ms": 99_999_999u64 }])
        ))
        .is_err());
        assert!(parse_value(&with("steps", json!([{ "type": "wait", "ms": -1 }]))).is_err());
        assert!(parse(b"").is_err());
        assert!(parse(b"not json").is_err());
        assert!(parse(b"[]").is_err());
        assert!(parse(b"null").is_err());
    }

    #[test]
    fn giant_fields_and_counts_are_rejected() {
        // A field far over its limit, still inside the file-size limit.
        assert!(parse_value(&with("name", json!("é".repeat(100_000)))).is_err());
        // Too many steps.
        let many = vec![json!({ "type": "wait", "ms": 1 }); MAX_STEPS + 1];
        assert!(parse_value(&with("steps", json!(many))).is_err());
        // Too many slots.
        let slots: Vec<String> = (0..=MAX_SLOTS).map(|n| format!("s{n}")).collect();
        assert!(parse_value(&with("slots", json!(slots))).is_err());
        // Over the size limit: refused before parsing.
        let big = with("name", json!("x".repeat(MAX_FILE_BYTES as usize)));
        assert!(parse(big.to_string().as_bytes()).is_err());
        assert!(parse(&vec![b' '; MAX_FILE_BYTES as usize + 1]).is_err());
    }

    #[test]
    fn deeply_nested_json_is_an_error_not_a_crash() {
        let depth = 100_000;
        let mut text = String::from(
            r#"{"format":"hubscene","schemaVersion":1,"name":"x","slots":[],"steps":"#,
        );
        text.push_str(&"[".repeat(depth));
        text.push_str(&"]".repeat(depth));
        text.push('}');
        assert!(parse(text.as_bytes()).is_err());
        // Same inside an unknown field, and inside an object.
        let nested = format!(
            r#"{{"format":"hubscene","extra":{}1{}}}"#,
            "[".repeat(depth),
            "]".repeat(depth)
        );
        assert!(parse(nested.as_bytes()).is_err());
        let objects = format!("{}1{}", r#"{"a":"#.repeat(depth), "}".repeat(depth));
        assert!(parse(objects.as_bytes()).is_err());
    }

    #[test]
    fn a_utf8_bom_is_accepted() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend(good().to_string().into_bytes());
        assert!(parse(&bytes).is_ok());
    }

    #[test]
    fn read_checks_extension_size_and_kind_before_reading() {
        let dir = tempfile::tempdir().unwrap();
        let ok = dir.path().join("a.HubScene");
        fs::write(&ok, good().to_string()).unwrap();
        assert!(read(&ok).is_ok());

        let wrong_ext = dir.path().join("a.json");
        fs::write(&wrong_ext, good().to_string()).unwrap();
        assert!(read(&wrong_ext).is_err());
        let exe = dir.path().join("a.exe");
        fs::write(&exe, good().to_string()).unwrap();
        assert!(read(&exe).is_err());

        let big = dir.path().join("big.hubscene");
        fs::write(&big, vec![b' '; MAX_FILE_BYTES as usize + 1]).unwrap();
        assert!(read(&big).is_err());

        let folder = dir.path().join("dir.hubscene");
        fs::create_dir(&folder).unwrap();
        assert!(read(&folder).is_err());
        assert!(read(&dir.path().join("missing.hubscene")).is_err());
    }

    #[test]
    fn exports_never_overwrite_an_earlier_one() {
        let dir = tempfile::tempdir().unwrap();
        let scene: SceneFile = serde_json::from_value(json!({
            "schemaVersion": 1, "id": "soiree", "name": "S", "steps": [{ "type": "launch", "slot": "a" }]
        }))
        .unwrap();
        let first = write_export(dir.path(), &scene).unwrap();
        let second = write_export(dir.path(), &scene).unwrap();
        assert_ne!(first, second);
        assert!(first.ends_with("soiree.hubscene") && second.ends_with("soiree-2.hubscene"));
        assert!(read(&second).is_ok());
    }
}
