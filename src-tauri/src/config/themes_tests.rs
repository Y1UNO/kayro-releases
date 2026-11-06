use std::fs;

use super::super::schema::is_theme_colour;
use super::super::tests::state;
use super::*;

fn theme(id: &str, name: &str) -> ThemeFile {
    ThemeFile {
        schema_version: 1,
        id: id.into(),
        name: name.into(),
        author: "Moi".into(),
        description: "Thème personnel.".into(),
        bg: ["#141A30".into(), "#0B0F1E".into(), "#05070F".into()],
        accent: "#A3B0DE".into(),
        glow: "rgba(114,130,188,.35)".into(),
        fog: [
            "rgba(163,176,222,.34)".into(),
            "rgba(163,176,222,.16)".into(),
            "rgba(114,130,188,.14)".into(),
        ],
        card: [163, 176, 222],
        beam: [114, 130, 188],
        gradient: Some(["#A3B0DE".into(), "#7282BC".into()]),
        soft: Some("#D3DAF2".into()),
    }
}

#[test]
fn colours_are_hex_or_plain_rgb_only() {
    for ok in [
        "#abc",
        "#A3B0DE",
        "#a3b0de80",
        "rgb(1, 2, 3)",
        "rgba(114,130,188,.35)",
    ] {
        assert!(is_theme_colour(ok), "{ok}");
    }
    for bad in [
        "url(http://x)",
        "red",
        "#12",
        "rgb(1,2,3);color:red",
        "rgba(1,2,3,var(--x))",
        "",
    ] {
        assert!(!is_theme_colour(bad), "{bad}");
    }
}

#[test]
fn ids_are_personal_unique_and_short() {
    let taken = |id: &str| id == "perso-foret-du-soir";
    assert_eq!(theme_id("Forêt du soir", taken), "perso-foret-du-soir-2");
    assert_eq!(theme_id("  !!  ", |_| false), "perso-theme");
    let long = theme_id(&"a".repeat(80), |_| false);
    assert!(long.len() <= 37 && long.starts_with(PREFIX));
}

#[test]
fn save_list_delete_round_trip() {
    let (dir, s) = state();
    let saved = s.save_theme(theme("perso-nuit", "Nuit")).unwrap();
    assert_eq!(s.themes(), vec![saved.clone()]);
    let file = dir.path().join("themes").join("perso-nuit.json");
    assert!(file.exists());
    // Read back by a fresh load, gradient and soft included.
    let again = ConfigState::load(crate::paths::DataPaths::new(dir.path()));
    assert_eq!(again.themes(), vec![saved]);
    s.delete_theme("perso-nuit").unwrap();
    assert!(s.themes().is_empty() && !file.exists());
    assert!(s.delete_theme("perso-nuit").is_err());
    assert!(s.delete_theme("../settings").is_err());
}

#[test]
fn bad_themes_are_refused() {
    let (_dir, s) = state();
    assert!(
        s.save_theme(theme("bleu-gris", "Copie")).is_err(),
        "built-in id"
    );
    let mut t = theme("perso-x", "X");
    t.accent = "url(http://evil)".into();
    assert!(s.save_theme(t).is_err());
    for n in 0..MAX_THEMES {
        s.save_theme(theme(&format!("perso-t{n}"), "T")).unwrap();
    }
    assert!(s.save_theme(theme("perso-one-more", "T")).is_err());
    // Replacing an existing one is still fine at the limit.
    assert!(s.save_theme(theme("perso-t0", "T bis")).is_ok());
}

#[test]
fn import_gives_a_fresh_id_and_export_never_overwrites() {
    let (dir, s) = state();
    let src = dir.path().join("partage.json");
    let mut shared = theme("bleu-gris", "Forêt");
    shared.gradient = None;
    shared.soft = None;
    fs::write(&src, serde_json::to_vec(&shared).unwrap()).unwrap();
    let imported = s.import_theme(&src).unwrap();
    assert_eq!(imported.id, "perso-foret");
    assert_eq!(s.import_theme(&src).unwrap().id, "perso-foret-2");

    let odd = dir.path().join("odd.json");
    fs::write(&odd, r#"{"schemaVersion":1,"script":"x"}"#).unwrap();
    assert!(s.import_theme(&odd).is_err());
    assert!(s.import_theme(&dir.path().join("partage.txt")).is_err());

    let out = dir.path().join("exports");
    fs::create_dir_all(&out).unwrap();
    let a = s.export_theme("perso-foret", &out).unwrap();
    let b = s.export_theme("perso-foret", &out).unwrap();
    assert_ne!(a, b);
    assert!(a.ends_with("perso-foret.json") && b.ends_with("perso-foret-2.json"));
}
