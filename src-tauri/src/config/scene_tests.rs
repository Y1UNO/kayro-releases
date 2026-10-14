//! Integration tests of `ConfigState` on a temporary data folder: scenes, slots, shared scenes.

use super::tests::{new_app, state};
use super::*;

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
