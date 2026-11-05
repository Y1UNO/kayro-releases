use super::*;
use crate::voice::command::{Intent, Music, Target};

fn prompt(key: &str, kind: CalibKind, expect: &str) -> CalibPrompt {
    CalibPrompt {
        key: key.into(),
        kind,
        text: "Dis Yuna, ouvre Discord".into(),
        expect: expect.into(),
    }
}

#[test]
fn a_key_names_a_file_and_nothing_else() {
    assert!(prompt_ok(&prompt("cmd-1", CalibKind::Command, "app:x")));
    for bad in ["", "../x", "a/b", "A1", "x.wav", "é", &"a".repeat(41)] {
        assert!(!prompt_ok(&prompt(bad, CalibKind::Wake, "wake")), "{bad}");
    }
    let mut long = prompt("ok", CalibKind::Chat, "none");
    long.text = "x".repeat(201);
    assert!(!prompt_ok(&long));
}

#[test]
fn intents_are_named_as_the_prompts_name_them() {
    assert_eq!(key(&Intent::Launch(Target::App("d".into()))), "app:d");
    assert_eq!(key(&Intent::Launch(Target::Scene("s".into()))), "scene:s");
    assert_eq!(key(&Intent::Close("d".into())), "close:d");
    assert_eq!(key(&Intent::Music(Music::Quieter)), "music:quieter");
    assert_eq!(key(&Intent::MusicMode(false)), "musicmode:off");
    assert_eq!(key(&Intent::ShowKayro), "show");
    assert_eq!(key(&Intent::Search("x".into())), "search");
    assert_eq!(key(&Intent::NotUnderstood), "unknown");
}

#[test]
fn a_saying_is_kept_as_a_wav_and_replaced_by_a_new_one() {
    let dir = tempfile::tempdir().unwrap();
    let p = prompt("wake-1", CalibKind::Wake, "wake");
    keep(dir.path(), &p, &vec![0.25; RATE as usize], &[0.3; 100]).unwrap();
    assert!(reference_of(dir.path(), "wake-1").exists());
    keep(dir.path(), &p, &vec![0.5; RATE as usize * 2], &[]).unwrap();
    assert!(!reference_of(dir.path(), "wake-1").exists());
    keep(
        dir.path(),
        &prompt("trap-1", CalibKind::Trap, "none"),
        &[0.0; 800],
        &[],
    )
    .unwrap();
    let m = load(dir.path());
    assert_eq!(m.entries.len(), 2);
    assert_eq!(m.entries[0].key, "wake-1");
    assert!((m.entries[0].seconds - 2.0).abs() < 1e-3);
    let wave = sherpa_onnx::Wave::read(&dir.path().join("wake-1.wav").to_string_lossy()).unwrap();
    assert_eq!(wave.sample_rate(), RATE);
    assert_eq!(wave.samples().len(), RATE as usize * 2);
    assert!((wave.samples()[10] - 0.5).abs() < 1e-3);
}

#[test]
fn a_score_of_an_older_shape_never_hides_the_recordings() {
    let dir = tempfile::tempdir().unwrap();
    keep(
        dir.path(),
        &prompt("wake-1", CalibKind::Wake, "wake"),
        &[0.0; 1600],
        &[],
    )
    .unwrap();
    let path = dir.path().join(MANIFEST);
    let mut m: serde_json::Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
    m["score"] = serde_json::json!({ "wake": { "right": 1, "total": 1 } });
    std::fs::write(&path, serde_json::to_vec(&m).unwrap()).unwrap();
    let back = load(dir.path());
    assert_eq!(back.entries.len(), 1);
    assert!(back
        .score
        .and_then(|v| serde_json::from_value::<CalibScore>(v).ok())
        .is_none());
}

#[test]
fn nothing_is_kept_without_a_prompt() {
    set_prompt(None);
    assert_eq!(save(&[0.0; 16], &[]), None);
}
