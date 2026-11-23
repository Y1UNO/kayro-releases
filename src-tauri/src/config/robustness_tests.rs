//! Audit before 1.0 (robustness): the data folder as a crash, a full disk or a hand edit leaves it.

use std::fs;

use super::tests::new_app;
use super::*;

/// Audit before 1.0 (robustness): every file damaged at once, in every way a crash, a full disk or
/// a hand edit leaves them. Kayro starts on defaults, sets each file aside and still saves after.
#[test]
fn every_file_damaged_at_once_still_starts_on_defaults() {
    let dir = tempfile::tempdir().unwrap();
    let paths = DataPaths::new(dir.path());
    let damaged: [&[u8]; 4] = [b"", b"{\"schemaVersion\":", b"\xff\xfe\x00garbage", b"[1,2,3]"];
    for (i, file) in [paths.settings(), paths.apps(), paths.slots(), paths.ui_state()]
        .iter()
        .enumerate()
    {
        fs::write(file, damaged[i % damaged.len()]).unwrap();
    }
    for (folder, name) in [
        (paths.scenes_dir(), "s.json"),
        (paths.themes_dir(), "t.json"),
        (paths.moods_dir(), "m.hubmood"),
    ] {
        fs::create_dir_all(&folder).unwrap();
        fs::write(folder.join(name), b"\x00\x01 not json").unwrap();
    }

    let s = ConfigState::load(paths.clone());
    assert_eq!(s.settings(), Settings::default());
    assert!(s.apps().apps.is_empty());
    assert!(paths.apps().with_extension("json.corrupt").exists());
    assert!(paths.settings().with_extension("json.corrupt").exists());

    // Still usable: the next save writes a sound file that reloads.
    s.add_app(new_app("Après la casse")).unwrap();
    let again = ConfigState::load(paths);
    assert_eq!(again.apps().apps.len(), 1);
}
