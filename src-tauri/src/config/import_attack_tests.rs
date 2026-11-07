//! Audit before 1.0 (step 18, docs/SECURITE.md): files made to hurt, dropped on Kayro as a theme
//! or an ambience. Each one must be refused cleanly — no crash, no write, nothing run.

use std::fs;

use super::tests::state;

/// Hostile files: (name, bytes). Each is tried as `.json` (theme) and `.hubmood` (ambience).
fn hostile() -> Vec<(&'static str, Vec<u8>)> {
    let deep = format!("{}{}", "[".repeat(30_000), "]".repeat(30_000));
    let mut zip = b"PK\x03\x04".to_vec();
    zip.extend(std::iter::repeat_n(0u8, 4096));
    vec![
        ("giant", vec![b' '; 70 * 1024]),
        ("deep", deep.into_bytes()),
        ("zip", zip),
        ("binary", (0..=255u8).cycle().take(8192).collect()),
        ("nul", b"{\"schemaVersion\":1,\0}".to_vec()),
        (
            "script",
            br#"{"schemaVersion":1,"name":"<script>alert(1)</script>","run":"calc.exe"}"#.to_vec(),
        ),
        (
            "paths",
            br#"{"schemaVersion":1,"name":"x","exe":"..\..\Windows\System32\cmd.exe"}"#.to_vec(),
        ),
        ("empty", Vec::new()),
    ]
}

#[test]
fn hostile_themes_and_ambiences_are_refused_without_writing_anything() {
    let (dir, s) = state();
    let themes_before = s.themes().len();
    let moods_before = s.moods().len();
    for (name, bytes) in hostile() {
        for ext in ["json", "hubmood"] {
            let file = dir.path().join(format!("{name}.{ext}"));
            fs::write(&file, &bytes).unwrap();
            let refused = if ext == "json" {
                s.import_theme(&file).is_err()
            } else {
                s.import_mood(&file).is_err()
            };
            assert!(refused, "{name}.{ext} was accepted");
        }
    }
    // A folder named like a theme, a missing file, a wrong extension.
    let folder = dir.path().join("dossier.json");
    fs::create_dir_all(&folder).unwrap();
    assert!(s.import_theme(&folder).is_err());
    assert!(s.import_theme(&dir.path().join("absent.json")).is_err());
    assert!(s.import_mood(&dir.path().join("giant.json")).is_err());
    assert_eq!(s.themes().len(), themes_before);
    assert_eq!(s.moods().len(), moods_before);
}
