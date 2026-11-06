//! Step 17b, Réglages › Sons: defaults, an older file, an out-of-range volume, a patch.

use std::fs;

use super::schema::{Settings, SettingsPatch, SoundPack};
use super::*;

fn load_settings(content: &str) -> (tempfile::TempDir, ConfigState) {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("settings.json"), content).unwrap();
    let s = ConfigState::load(DataPaths::new(dir.path()));
    (dir, s)
}

#[test]
fn sounds_are_on_premium_and_low_by_default() {
    let s = Settings::default();
    assert!(s.sounds_on);
    assert_eq!(s.sound_pack, SoundPack::Premium);
    assert_eq!(s.sound_volume, 0.4);
    assert!(s.sound_interface && s.sound_transitions && s.sound_launch);
}

#[test]
fn an_older_file_gets_the_sound_defaults_and_keeps_the_rest() {
    let (_dir, s) = load_settings(r#"{"schemaVersion":2,"hideOnBlur":true}"#);
    let s = s.settings();
    assert!(s.hide_on_blur);
    assert!(s.sounds_on);
    assert_eq!(s.sound_volume, 0.4);
}

#[test]
fn a_volume_out_of_range_falls_back_and_a_patch_is_checked() {
    let (_dir, state) =
        load_settings(r#"{"schemaVersion":2,"soundVolume":3,"soundPack":"chiptune"}"#);
    assert_eq!(state.settings().sound_volume, 0.4);
    assert_eq!(state.settings().sound_pack, SoundPack::Chiptune);
    let out = state
        .set_settings(SettingsPatch {
            sound_volume: Some(0.8),
            sound_pack: Some(SoundPack::Retro),
            sound_launch: Some(false),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(out.sound_volume, 0.8);
    assert_eq!(out.sound_pack, SoundPack::Retro);
    assert!(!out.sound_launch);
    let refused = state.set_settings(SettingsPatch {
        sound_volume: Some(1.5),
        ..Default::default()
    });
    assert!(refused.is_err());
    assert_eq!(state.settings().sound_volume, 0.8);
}
