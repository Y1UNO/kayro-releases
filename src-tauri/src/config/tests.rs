//! Integration tests of `ConfigState` on a temporary data folder.

use std::fs;

use super::apps::{AppSource, Art, Launch, MatchRule, NewApp};
use super::schema::{ColorMode, Quality, SettingsPatch};
use super::*;

/// Each call gets its own program path: the same target cannot be added twice.
fn new_app(name: &str) -> NewApp {
    static NEXT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    NewApp {
        name: name.into(),
        category: "jeux".into(),
        source: AppSource::Manual,
        launch: Launch::Exe {
            path: format!("C:\\Games\\a{n}.exe"),
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
    assert_eq!(out.theme_id, "lavande-peche", "untouched fields stay");

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

#[test]
fn the_same_program_cannot_be_added_twice_even_from_another_source_or_letter_case() {
    let (_d, s) = state();
    let first = new_app("One");
    s.add_app(first.clone()).unwrap();
    let mut again = first;
    again.name = "Other name".into();
    if let Launch::Exe { path, .. } = &mut again.launch {
        *path = path.to_uppercase().replace('\\', "/");
    }
    assert_eq!(s.add_app(again).unwrap_err().code, ErrorCode::Duplicate);
}

#[test]
fn the_same_program_with_other_arguments_is_another_app() {
    let (_d, s) = state();
    let plain = new_app("Game");
    let mut modded = plain.clone();
    modded.name = "Game modded".into();
    if let Launch::Exe { args, .. } = &mut modded.launch {
        *args = vec!["-mod".into()];
    }
    s.add_app(plain).unwrap();
    s.add_app(modded).unwrap();
}

#[test]
fn add_apps_keeps_the_good_ones_reports_the_bad_ones_and_writes_once() {
    let (dir, s) = state();
    let good = new_app("Good");
    let mut invalid = new_app("Invalid");
    invalid.name = String::new();
    let twice = good.clone();
    let report = s
        .add_apps(vec![good, invalid, twice, new_app("Also good")])
        .unwrap();
    assert_eq!(report.added.len(), 2);
    let failures: Vec<_> = report
        .failed
        .iter()
        .map(|f| (f.index, f.error.code))
        .collect();
    assert_eq!(
        failures,
        [(1, ErrorCode::Validation), (2, ErrorCode::Duplicate)]
    );
    let reloaded = ConfigState::load(DataPaths::new(dir.path()));
    assert_eq!(reloaded.apps().apps, report.added);
}

#[test]
fn add_apps_with_nothing_valid_writes_nothing() {
    let (dir, s) = state();
    let mut bad = new_app("Bad");
    bad.category = String::new();
    let report = s.add_apps(vec![bad]).unwrap();
    assert!(report.added.is_empty() && report.failed.len() == 1);
    assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
}

#[test]
fn editing_an_app_onto_another_apps_target_is_refused() {
    let (_d, s) = state();
    let a = s.add_app(new_app("A")).unwrap();
    let mut b = s.add_app(new_app("B")).unwrap();
    b.launch = a.launch.clone();
    assert_eq!(s.update_app(b).unwrap_err().code, ErrorCode::Duplicate);
    // Saving an app unchanged is not a duplicate of itself.
    s.update_app(a).unwrap();
}

fn scene_json(id: &str) -> schema::SceneFile {
    serde_json::from_value(serde_json::json!({
        "schemaVersion": 1, "id": id, "name": "S",
        "steps": [{"type": "launch", "slot": "musique"}]
    }))
    .unwrap()
}

#[test]
fn scenes_are_saved_atomically_replaced_and_reloaded() {
    let (dir, s) = state();
    s.save_scene(scene_json("b")).unwrap();
    s.save_scene(scene_json("a")).unwrap();
    let mut renamed = scene_json("a");
    renamed.name = "Renamed".into();
    s.save_scene(renamed).unwrap();
    let ids: Vec<_> = s.scenes().iter().map(|x| x.id.clone()).collect();
    assert_eq!(ids, ["a", "b"]);
    assert_eq!(s.scene("a").unwrap().name, "Renamed");
    assert!(!dir.path().join("scenes/a.json.tmp").exists());
    let reloaded = ConfigState::load(DataPaths::new(dir.path()));
    assert_eq!(reloaded.scenes(), s.scenes());

    let mut bad = scene_json("bad");
    bad.steps = vec![scene::Step::Launch {
        slot: r"C:\x.exe".into(),
        required: false,
    }];
    assert_eq!(s.save_scene(bad).unwrap_err().code, ErrorCode::Validation);
    assert!(!dir.path().join("scenes/bad.json").exists());
}

#[test]
fn slots_are_validated_saved_and_reloaded() {
    let (dir, s) = state();
    let ok = BTreeMap::from([("musique".to_string(), "spotify".to_string())]);
    s.set_slots(ok.clone()).unwrap();
    assert_eq!(s.slots().slots, ok);
    assert_eq!(
        ConfigState::load(DataPaths::new(dir.path())).slots().slots,
        ok
    );
    for bad in [
        ("Musique", "x"),
        ("a b", "x"),
        ("a", r"C:\app.exe"),
        ("a", ""),
    ] {
        let map = BTreeMap::from([(bad.0.to_string(), bad.1.to_string())]);
        assert_eq!(
            s.set_slots(map).unwrap_err().code,
            ErrorCode::Validation,
            "{bad:?}"
        );
    }
    assert_eq!(
        s.slots().slots,
        ok,
        "a refused change leaves the slots alone"
    );
}

fn shared(steps: serde_json::Value, slots: &[&str]) -> share::HubSceneFile {
    serde_json::from_value(serde_json::json!({
        "format": "hubscene", "schemaVersion": 1, "name": "Soirée", "slots": slots, "steps": steps
    }))
    .unwrap()
}

#[test]
fn delete_scene_removes_file_and_refuses_odd_ids() {
    let (dir, s) = state();
    s.save_scene(scene_json("a")).unwrap();
    assert!(dir.path().join("scenes/a.json").exists());
    assert_eq!(
        s.delete_scene("../a").unwrap_err().code,
        ErrorCode::Validation
    );
    assert_eq!(s.delete_scene("zz").unwrap_err().code, ErrorCode::NotFound);
    s.delete_scene("a").unwrap();
    assert!(!dir.path().join("scenes/a.json").exists() && s.scenes().is_empty());
}

#[test]
fn new_scene_ids_are_slugs_and_unique() {
    let (_dir, s) = state();
    assert_eq!(s.new_scene_id("Soirée gaming !"), "soiree-gaming");
    assert_eq!(s.new_scene_id("???"), "scene");
    s.save_scene(scene_json("soiree-gaming")).unwrap();
    assert_eq!(s.new_scene_id("Soirée gaming"), "soiree-gaming-2");
}

#[test]
fn import_links_slots_and_never_replaces_a_scene() {
    let (_dir, s) = state();
    let app = s.add_app(new_app("Discord")).unwrap();
    let file = shared(
        serde_json::json!([{"type":"launch","slot":"messagerie"},{"type":"launch","slot":"musique"}]),
        &["messagerie", "musique"],
    );
    // Nothing linked yet: no suggestion.
    assert!(s
        .preview_import(&file)
        .slots
        .iter()
        .all(|x| x.suggested_app.is_none()));

    let links = BTreeMap::from([("messagerie".to_string(), app.id.clone())]);
    let scene = s.import_scene(&file, &links).unwrap();
    assert_eq!(
        (scene.id.as_str(), scene.name.as_str()),
        ("soiree", "Soirée")
    );
    assert_eq!(s.slots().slots.get("messagerie"), Some(&app.id));
    assert!(!s.slots().slots.contains_key("musique"));
    let preview = s.preview_import(&file);
    assert_eq!(
        preview.slots[0].suggested_app.as_deref(),
        Some(app.id.as_str())
    );

    // Importing again makes a second scene.
    let again = s.import_scene(&file, &links).unwrap();
    assert_eq!(
        (again.id.as_str(), again.name.as_str()),
        ("soiree-2", "Soirée (2)")
    );
    assert_eq!(s.scenes().len(), 2);
}

#[test]
fn import_refuses_unknown_slots_and_apps_and_writes_nothing() {
    let (_dir, s) = state();
    let file = shared(serde_json::json!([{"type":"launch","slot":"a"}]), &["a"]);
    let unknown_slot = BTreeMap::from([("zzz".to_string(), "x".to_string())]);
    assert_eq!(
        s.import_scene(&file, &unknown_slot).unwrap_err().code,
        ErrorCode::Validation
    );
    let unknown_app = BTreeMap::from([("a".to_string(), "ghost".to_string())]);
    assert_eq!(
        s.import_scene(&file, &unknown_app).unwrap_err().code,
        ErrorCode::NotFound
    );
    assert!(s.scenes().is_empty() && s.slots().slots.is_empty());
}

#[test]
fn display_settings_default_for_an_older_file_and_reject_unknown_values() {
    use super::schema::{DisplayMode, WidgetStyle};
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("settings.json"),
        r#"{"schemaVersion":1,"quality":"high"}"#,
    )
    .unwrap();
    let s = ConfigState::load(DataPaths::new(dir.path())).settings();
    assert_eq!(s.display_mode, DisplayMode::Immersive);
    assert_eq!(s.widget_style, WidgetStyle::Brume);
    assert!(s.hide_on_escape && !s.hide_on_blur && !s.economy_mode);

    // A value that is not one of the choices keeps its default; the rest of the file is kept.
    fs::write(
        dir.path().join("settings.json"),
        r#"{"schemaVersion":1,"displayMode":"fullscreen","widgetStyle":"orbe","economyMode":true}"#,
    )
    .unwrap();
    let s = ConfigState::load(DataPaths::new(dir.path())).settings();
    assert_eq!(s.display_mode, DisplayMode::Immersive);
    assert_eq!(s.widget_style, WidgetStyle::Orbe);
    assert!(s.economy_mode);
}

#[test]
fn recents_and_placements_persist_across_a_reload() {
    let dir = tempfile::tempdir().unwrap();
    let state = ConfigState::load(DataPaths::new(dir.path()));
    for id in ["a", "b", "a"] {
        state.update_ui_state(|ui| ui.push_recent(id)).unwrap();
    }
    state
        .update_ui_state(|ui| {
            ui.widget.rect = Some(super::ui_state::Rect {
                x: 5,
                y: 12,
                width: 700,
                height: 80,
            });
            true
        })
        .unwrap();
    let again = ConfigState::load(DataPaths::new(dir.path())).ui_state();
    assert_eq!(again.recents, ["a", "b"]);
    assert_eq!(again.widget.rect.unwrap().width, 700);
}
