//! R5 settings: new « Visuel » fields, their defaults, and the v1 → v2 migration.

use std::fs;

use super::schema::{
    CardFloat, CardHoverStyle, Elasticity, MotionStyle, OpeningStyle, Quality, Settings,
    SettingsPatch, ThemeTransition, WidgetUnroll,
};
use super::*;

fn load_settings(content: &str) -> (tempfile::TempDir, Settings) {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("settings.json"), content).unwrap();
    let s = ConfigState::load(DataPaths::new(dir.path())).settings();
    (dir, s)
}

#[test]
fn defaults_are_the_validated_look() {
    let s = Settings::default();
    assert_eq!(s.schema_version, 2);
    assert_eq!(s.theme_id, "bleu-gris");
    assert_eq!(s.quality, Quality::Balanced);
    assert_eq!(s.atmosphere_intensity, 1.0);
    assert_eq!(s.motion_style, MotionStyle::Lively);
    assert!(s.follow_system_motion);
    assert_eq!(s.card_float, CardFloat::Visible);
    assert_eq!(s.opening_style, OpeningStyle::Pulse);
    assert_eq!(s.theme_transition, ThemeTransition::Wave);
    assert_eq!(s.widget_unroll, WidgetUnroll::Unroll);
    assert_eq!(s.widget_spring, Elasticity::Normal);
    assert_eq!(s.card_hover, CardHoverStyle::Full);
    assert!(s.bokeh && s.particles && s.cursor_light);
}

#[test]
fn a_v1_file_migrates_with_a_backup_and_keeps_its_values() {
    let (dir, s) = load_settings(
        r#"{"schemaVersion":1,"themeId":"lavande-peche","quality":"high","displayMode":"window"}"#,
    );
    assert_eq!(s.theme_id, "lavande-peche", "logo themes are kept");
    assert_eq!(s.quality, Quality::High);
    assert_eq!(
        s.card_float,
        CardFloat::Visible,
        "new fields take their default"
    );
    assert!(dir.path().join("settings.json.bak").exists());
    let on_disk: serde_json::Value =
        serde_json::from_slice(&fs::read(dir.path().join("settings.json")).unwrap()).unwrap();
    assert_eq!(on_disk["schemaVersion"], 2);
    assert_eq!(on_disk["cardFloat"], "visible");
}

#[test]
fn mauve_becomes_encre_and_retired_themes_become_bleu_gris() {
    let (_d, s) = load_settings(r#"{"schemaVersion":1,"themeId":"mauve"}"#);
    assert_eq!(s.theme_id, "encre");
    for old in ["crepuscule", "boreale", "ocean", "rose", "graphite"] {
        let (_d, s) = load_settings(&format!(r#"{{"schemaVersion":1,"themeId":"{old}"}}"#));
        assert_eq!(s.theme_id, "bleu-gris", "{old}");
    }
    // A v2 file is not migrated again: whatever it says stays.
    let (_d, s) = load_settings(r#"{"schemaVersion":2,"themeId":"ocean"}"#);
    assert_eq!(s.theme_id, "ocean");
}

#[test]
fn unknown_choices_keep_their_default_and_the_rest_of_the_file() {
    let (_d, s) = load_settings(
        r#"{"schemaVersion":2,"cardFloat":"huge","motionStyle":"crisp","quality":"auto","bokeh":false}"#,
    );
    assert_eq!(s.card_float, CardFloat::Visible);
    assert_eq!(s.motion_style, MotionStyle::Crisp);
    assert_eq!(s.quality, Quality::Auto);
    assert!(!s.bokeh);
}

#[test]
fn patches_reach_every_new_field_and_atmosphere_goes_up_to_1_3() {
    let dir = tempfile::tempdir().unwrap();
    let state = ConfigState::load(DataPaths::new(dir.path()));
    let out = state
        .set_settings(SettingsPatch {
            atmosphere_intensity: Some(1.3),
            motion_style: Some(MotionStyle::Complete),
            follow_system_motion: Some(false),
            card_float: Some(CardFloat::Strong),
            opening_style: Some(OpeningStyle::None),
            theme_transition: Some(ThemeTransition::Fade),
            widget_unroll: Some(WidgetUnroll::Sober),
            widget_spring: Some(Elasticity::Soft),
            card_hover: Some(CardHoverStyle::Simple),
            bokeh: Some(false),
            particles: Some(false),
            cursor_light: Some(false),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(out.atmosphere_intensity, 1.3);
    assert_eq!(out.card_hover, CardHoverStyle::Simple);
    let again = ConfigState::load(DataPaths::new(dir.path())).settings();
    assert_eq!(again, out, "persisted as written");
    let e = state
        .set_settings(SettingsPatch {
            atmosphere_intensity: Some(1.4),
            ..Default::default()
        })
        .unwrap_err();
    assert_eq!(e.field.as_deref(), Some("atmosphereIntensity"));
}

#[test]
fn game_colour_choices_default_to_the_board_and_unknown_values_fall_back() {
    use super::schema::{ColorCharacter, ColorIntensity, ColorPassage, ColorPick, ColorTrigger};
    let s = Settings::default();
    assert_eq!(s.color_intensity, ColorIntensity::Normal);
    assert_eq!(s.color_character, ColorCharacter::Theme);
    assert_eq!(s.color_pick, ColorPick::Dominant);
    assert_eq!(s.color_passage, ColorPassage::Tide);
    assert_eq!(s.color_trigger, ColorTrigger::Select);
    assert!(s.color_from_icon);
    // An older file has none of them; a hand-edited one may hold nonsense: defaults, the rest kept.
    let (_d, s) = load_settings(
        r#"{"schemaVersion":2,"colorPassage":"wave","colorTrigger":"launch","colorHero":false,"colorMode":"immersive"}"#,
    );
    assert_eq!(s.color_passage, ColorPassage::Tide);
    assert_eq!(s.color_trigger, ColorTrigger::Launch);
    // 30/10: the immersive mode is gone; an older file keeps the game's colours (« Stylisé »).
    assert_eq!(s.color_mode, super::schema::ColorMode::Light);
    let dir = tempfile::tempdir().unwrap();
    let state = ConfigState::load(DataPaths::new(dir.path()));
    let out = state
        .set_settings(SettingsPatch {
            color_intensity: Some(ColorIntensity::Strong),
            color_pick: Some(ColorPick::Vivid),
            color_from_icon: Some(false),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(
        ConfigState::load(DataPaths::new(dir.path())).settings(),
        out
    );
}

#[test]
fn opening_screen_defaults_to_the_last_one_and_survives_odd_values() {
    use super::schema::OpeningScreen;
    assert_eq!(Settings::default().opening_screen, OpeningScreen::Last);
    let (_dir, s) = load_settings(r#"{"schemaVersion":2,"openingScreen":"pointer"}"#);
    assert_eq!(s.opening_screen, OpeningScreen::Pointer);
    let (_dir, s) = load_settings(r#"{"schemaVersion":2,"openingScreen":"moon","quality":"high"}"#);
    assert_eq!(s.opening_screen, OpeningScreen::Last);
    assert_eq!(s.quality, Quality::High);
    let mut s = Settings::default();
    s.apply(SettingsPatch {
        opening_screen: Some(OpeningScreen::Main),
        ..Default::default()
    });
    assert_eq!(s.opening_screen, OpeningScreen::Main);
}
