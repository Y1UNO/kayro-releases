use super::*;
use crate::config::schema::StrictFile;
use serde_json::{json, Value};

fn runes() -> Value {
    json!({
        "schemaVersion": 1, "id": "runes", "name": "Runes spectrales", "gameHint": "Hades II",
        "glyphs": { "rune-a": "M0 0 L10 0 L5 9 Z" },
        "layers": [
            { "type": "particles", "shape": "ember", "count": 26, "size": [3, 7], "speed": [20, 60],
              "direction": "up", "drift": 0.3, "life": [6, 12], "colorRole": "accent", "opacity": 0.8 },
            { "type": "glyphRing", "glyph": "rune-a", "count": 12, "radius": 0.34, "rotation": 4,
              "size": 18, "colorRole": "accent", "opacity": 0.5 },
            { "type": "mist", "count": 4, "colorRole": "dominant", "opacity": 0.25, "speed": 6 },
            { "type": "beam", "count": 2, "sway": 3, "colorRole": "accent", "opacity": 0.4 },
            { "type": "pulse", "period": 6, "colorRole": "dominant", "opacity": 0.5 }
        ]
    })
}

fn parse(v: &Value) -> Result<MoodFile, String> {
    let m: MoodFile = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
    m.check()?;
    Ok(m)
}

fn with(path: &str, value: Value) -> Value {
    let mut v = runes();
    *v.pointer_mut(path).unwrap() = value;
    v
}

#[test]
fn the_example_of_the_architecture_parses_and_round_trips() {
    let m = parse(&runes()).unwrap();
    assert_eq!(m.layers.len(), 5);
    let back = serde_json::to_value(&m).unwrap();
    assert_eq!(parse(&back).unwrap(), m);
}

#[test]
fn unknown_fields_and_types_are_refused() {
    let mut v = runes();
    v["script"] = json!("alert(1)");
    assert!(parse(&v).is_err());
    let mut v = runes();
    v["layers"][0]["onClick"] = json!("x");
    assert!(parse(&v).is_err());
    assert!(parse(&with("/layers/2/type", json!("video"))).is_err());
    assert!(parse(&with("/layers/0/colorRole", json!("#ff0000"))).is_err());
    let mut v = runes();
    v["launch"] = json!("seal");
    assert_eq!(parse(&v).unwrap().launch, Some(LaunchStyle::Seal));
    v["launch"] = json!("explode");
    assert!(parse(&v).is_err());
}

#[test]
fn limits_are_enforced() {
    assert!(parse(&with("/layers/0/count", json!(81))).is_err());
    assert!(parse(&with("/layers/0/count", json!(0))).is_err());
    assert!(parse(&with("/layers/0/size", json!([8, 3]))).is_err());
    assert!(parse(&with("/layers/0/speed", json!([0, 1000]))).is_err());
    assert!(parse(&with("/layers/1/radius", json!(2))).is_err());
    assert!(parse(&with("/layers/2/opacity", json!(0.9))).is_err());
    assert!(parse(&with("/schemaVersion", json!(2))).is_err());
    assert!(parse(&with("/name", json!(""))).is_err());
    let mut v = runes();
    let layer = v["layers"][2].clone();
    v["layers"] = json!(vec![layer; 7]);
    assert!(parse(&v).is_err());
    assert!(parse(&with("/layers", json!([]))).is_err());
}

#[test]
fn glyphs_must_exist_and_be_plain_path_data() {
    assert!(parse(&with("/layers/1/glyph", json!("nope"))).is_err());
    let mut v = runes();
    v["layers"][0]["shape"] = json!("glyph");
    assert!(parse(&v).is_err(), "a glyph particle names its glyph");
    v["layers"][0]["glyph"] = json!("rune-a");
    assert!(parse(&v).is_ok());
    for bad in [
        "M0 0 L1 1\" onload=\"x",
        "<path d='M0 0'/>",
        "url(#a)",
        "L0 0",
        "",
        "M0 0;alert(1)",
    ] {
        assert!(check_path(bad).is_err(), "{bad}");
    }
    assert!(check_path(&format!("M0 0{}", " L1 1".repeat(400))).is_err());
    assert!(check_path("M10.5 -3e1 C 1,2 3,4 5,6 z").is_ok());
    let mut v = runes();
    v["glyphs"]["Bad Name"] = json!("M0 0");
    assert!(parse(&v).is_err());
}

#[test]
fn tunes_are_bounded() {
    assert!(validate_tune(&MoodTune {
        density: 1.0,
        speed: 1.0
    })
    .is_ok());
    assert!(validate_tune(&MoodTune {
        density: 3.0,
        speed: 1.0
    })
    .is_err());
    assert!(validate_tune(&MoodTune {
        density: 1.0,
        speed: f32::NAN
    })
    .is_err());
}

mod store {
    use super::runes;
    use crate::config::mood_store::export_mood;
    use crate::config::ConfigState;
    use crate::paths::DataPaths;
    use std::fs;

    #[test]
    fn import_gives_a_fresh_id_and_survives_a_reload() {
        let dir = tempfile::tempdir().unwrap();
        let paths = DataPaths::new(dir.path());
        let state = ConfigState::load(paths.clone());
        let file = dir.path().join("Runes.hubmood");
        fs::write(&file, runes().to_string()).unwrap();
        let a = state.import_mood(&file).unwrap();
        let b = state.import_mood(&file).unwrap();
        assert_eq!(a.id, "perso-runes-spectrales");
        assert_eq!(b.id, "perso-runes-spectrales-2");
        let again = ConfigState::load(paths);
        assert_eq!(again.moods().len(), 2);
        again.delete_mood(&a.id).unwrap();
        assert_eq!(again.moods().len(), 1);
        assert!(
            again.delete_mood("runes").is_err(),
            "built-in ids are not files"
        );
    }

    #[test]
    fn refused_files_write_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let state = ConfigState::load(DataPaths::new(dir.path()));
        let json = dir.path().join("x.json");
        fs::write(&json, runes().to_string()).unwrap();
        assert!(state.import_mood(&json).is_err(), "wrong extension");
        let bad = dir.path().join("x.hubmood");
        fs::write(&bad, "{\"schemaVersion\":1}").unwrap();
        assert!(state.import_mood(&bad).is_err());
        let big = dir.path().join("big.hubmood");
        fs::write(&big, " ".repeat(70 * 1024)).unwrap();
        assert!(state.import_mood(&big).is_err());
        assert!(state.moods().is_empty());
        assert!(!dir.path().join("moods").exists());
    }

    #[test]
    fn export_never_overwrites() {
        let dir = tempfile::tempdir().unwrap();
        let mood = serde_json::from_value(runes()).unwrap();
        let a = export_mood(&mood, dir.path()).unwrap();
        let b = export_mood(&mood, dir.path()).unwrap();
        assert_ne!(a, b);
        assert!(b.ends_with("runes-2.hubmood"));
    }
}
