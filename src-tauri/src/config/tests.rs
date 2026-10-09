//! Integration tests of `ConfigState` on a temporary data folder.

use std::fs;

use super::apps::{AppSource, Art, Launch, MatchRule, NewApp};
use super::schema::{ColorMode, Quality, SettingsPatch};
use super::*;

fn new_app(name: &str) -> NewApp {
    NewApp {
        name: name.into(),
        category: "jeux".into(),
        source: AppSource::Manual,
        launch: Launch::Exe {
            path: "C:\\Games\\a.exe".into(),
            args: vec![],
            cwd: None,
            elevated: false,
        },
        match_rule: MatchRule::default(),
        art: Art::default(),
        mood_id: None,
        favorite: false,
    }
}

fn state() -> (tempfile::TempDir, ConfigState) {
    let dir = tempfile::tempdir().unwrap();
    let state = ConfigState::load(DataPaths::new(dir.path()));
    (dir, state)
}

#[test]
fn first_start_gives_defaults_and_creates_no_file() {
    let (dir, s) = state();
    assert_eq!(s.settings(), Settings::default());
    assert!(s.apps().apps.is_empty());
    assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
}

#[test]
fn add_list_reload_update_remove() {
    let (dir, s) = state();
    let added = s.add_app(new_app("Half-Life 2")).unwrap();
    assert_eq!(added.id, "half-life-2");
    assert_eq!(s.apps().apps, vec![added.clone()]);

    // Survives a restart.
    let reloaded = ConfigState::load(DataPaths::new(dir.path()));
    assert_eq!(reloaded.apps().apps, vec![added.clone()]);

    let mut edited = added.clone();
    edited.favorite = true;
    edited.name = "HL2".into();
    s.update_app(edited.clone()).unwrap();
    let again = ConfigState::load(DataPaths::new(dir.path()));
    assert_eq!(again.apps().apps, vec![edited]);

    s.remove_app("half-life-2").unwrap();
    assert!(s.apps().apps.is_empty());
    assert!(ConfigState::load(DataPaths::new(dir.path()))
        .apps()
        .apps
        .is_empty());
}

#[test]
fn ids_are_unique_and_valid() {
    let (_d, s) = state();
    let ids: Vec<_> = ["Pokémon Épée", "Pokémon Épée", "!!!", "", "A  B"]
        .iter()
        .map(|n| s.add_app(new_app(n)).map(|a| a.id))
        .collect();
    // Empty name is refused by validation; the rest get distinct slugs.
    assert_eq!(ids[0].as_ref().unwrap(), "pokemon-epee");
    assert_eq!(ids[1].as_ref().unwrap(), "pokemon-epee-2");
    assert_eq!(ids[2].as_ref().unwrap(), "app");
    assert_eq!(ids[3].as_ref().unwrap_err().code, ErrorCode::Validation);
    assert_eq!(ids[4].as_ref().unwrap(), "a-b");
}

#[test]
fn errors_are_typed() {
    let (_d, s) = state();
    let mut bad = new_app("x");
    bad.launch = Launch::Uri {
        uri: "file:///C:/a.exe".into(),
    };
    let e = s.add_app(bad).unwrap_err();
    assert_eq!(
        (e.code, e.field.as_deref()),
        (ErrorCode::Validation, Some("launch.uri"))
    );
    assert_eq!(s.remove_app("ghost").unwrap_err().code, ErrorCode::NotFound);
    let ghost = new_app("ghost").with_id("ghost".into());
    assert_eq!(s.update_app(ghost).unwrap_err().code, ErrorCode::NotFound);
    let mut steam = new_app("CS");
    steam.source = AppSource::Steam {
        app_id: "730".into(),
    };
    s.add_app(steam.clone()).unwrap();
    assert_eq!(s.add_app(steam).unwrap_err().code, ErrorCode::Duplicate);
    assert_eq!(s.apps().apps.len(), 1, "refused calls change nothing");
}

#[test]
fn failed_write_rolls_back_memory_and_disk() {
    let (dir, s) = state();
    let kept = s.add_app(new_app("Kept")).unwrap();
    // Make the final rename impossible: a folder now sits where apps.json should be replaced.
    let apps_json = dir.path().join("apps.json");
    let backup = fs::read(&apps_json).unwrap();
    fs::remove_file(&apps_json).unwrap();
    fs::create_dir(&apps_json).unwrap();
    let e = s.add_app(new_app("Lost")).unwrap_err();
    assert_eq!(e.code, ErrorCode::Io);
    assert_eq!(
        s.apps().apps,
        vec![kept],
        "memory unchanged after a failed save"
    );
    fs::remove_dir(&apps_json).unwrap();
    fs::write(&apps_json, backup).unwrap();
}

#[test]
fn settings_patch_is_validated_and_persisted() {
    let (dir, s) = state();
    let out = s
        .set_settings(SettingsPatch {
            quality: Some(Quality::Ultra),
            color_mode: Some(ColorMode::Off),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(
        (out.quality, out.color_mode),
        (Quality::Ultra, ColorMode::Off)
    );
    assert_eq!(out.theme_id, "crepuscule", "untouched fields stay");

    let e = s
        .set_settings(SettingsPatch {
            hotkey: Some("nope".into()),
            ..Default::default()
        })
        .unwrap_err();
    assert_eq!(
        (e.code, e.field.as_deref()),
        (ErrorCode::Validation, Some("hotkey"))
    );
    assert_eq!(s.settings().hotkey, "Ctrl+Alt+H");

    let reloaded = ConfigState::load(DataPaths::new(dir.path()));
    assert_eq!(reloaded.settings(), out);
}

#[test]
fn hand_corrupted_files_never_stop_the_start() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("apps.json"), "this is not json at all {{{").unwrap();
    fs::write(dir.path().join("settings.json"), [0u8, 159, 146, 150]).unwrap();
    fs::write(dir.path().join("slots.json"), "").unwrap();
    fs::create_dir(dir.path().join("themes")).unwrap();
    fs::write(dir.path().join("themes").join("x.json"), "{").unwrap();
    let s = ConfigState::load(DataPaths::new(dir.path()));
    assert!(s.apps().apps.is_empty());
    assert_eq!(s.settings(), Settings::default());
    assert!(s.themes().is_empty());
    for f in [
        "apps.json.corrupt",
        "settings.json.corrupt",
        "slots.json.corrupt",
    ] {
        assert!(dir.path().join(f).exists(), "{f}");
    }
    // …and the app keeps working afterwards.
    s.add_app(new_app("Fresh")).unwrap();
    assert_eq!(
        ConfigState::load(DataPaths::new(dir.path()))
            .apps()
            .apps
            .len(),
        1
    );
}

#[test]
fn atmosphere_intensity_defaults_and_out_of_range_values() {
    let dir = tempfile::tempdir().unwrap();
    // A settings file written before the field existed: full intensity.
    fs::write(
        dir.path().join("settings.json"),
        r#"{"schemaVersion":1,"quality":"high"}"#,
    )
    .unwrap();
    let s = ConfigState::load(DataPaths::new(dir.path()));
    assert_eq!(s.settings().atmosphere_intensity, 1.0);
    assert_eq!(s.settings().quality, Quality::High);

    // Out of range in the file: the default replaces it, the rest is kept.
    fs::write(
        dir.path().join("settings.json"),
        r#"{"schemaVersion":1,"quality":"eco","atmosphereIntensity":7}"#,
    )
    .unwrap();
    let s = ConfigState::load(DataPaths::new(dir.path()));
    assert_eq!(s.settings().atmosphere_intensity, 1.0);
    assert_eq!(s.settings().quality, Quality::Eco);

    let out = s
        .set_settings(SettingsPatch {
            atmosphere_intensity: Some(0.5),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(out.atmosphere_intensity, 0.5);
    let e = s
        .set_settings(SettingsPatch {
            atmosphere_intensity: Some(0.1),
            ..Default::default()
        })
        .unwrap_err();
    assert_eq!(e.field.as_deref(), Some("atmosphereIntensity"));
}
