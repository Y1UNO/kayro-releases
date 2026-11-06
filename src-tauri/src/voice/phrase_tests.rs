//! The whole always mode on spoken files, with the real models: speech detection, the small
//! French model and the wake word, Parakeet leaning toward the user's words, then the command.
//! `#[ignore]`: it needs the models (`KAYRO_VOICE_MODELS`, else `%APPDATA%/Kayro/voice`) and the
//! files (`KAYRO_VOICE_WAVS`: 16 kHz mono WAV named as below, made with Windows' French voice,
//! at its normal pace and faster). `cargo test -p hub --release spoken -- --ignored --nocapture`.

use std::path::PathBuf;

use super::*;
use crate::config::schema::VoiceModel;
use crate::voice::command::{hotwords, parse, Intent, Music, Named, Target};
use crate::voice::engine;

fn named(list: &[(&str, &str)]) -> Vec<Named> {
    list.iter()
        .map(|(id, name)| Named {
            id: (*id).into(),
            name: (*name).into(),
        })
        .collect()
}

#[test]
#[ignore]
fn spoken_commands_do_what_they_say() {
    let models =
        std::env::var_os("KAYRO_VOICE_MODELS").map_or_else(engine::voice_dir, PathBuf::from);
    let wavs = PathBuf::from(std::env::var_os("KAYRO_VOICE_WAVS").expect("KAYRO_VOICE_WAVS"));
    let (vad, stream) = (
        engine::vad(&models).unwrap(),
        engine::wake(&models).unwrap(),
    );
    let asr = engine::command(&models, VoiceModel::Parakeet).unwrap();
    let apps = named(&[
        ("elden", "Elden Ring"),
        ("discord", "Discord"),
        ("spotify", "Spotify"),
        ("bg3", "Baldur's Gate 3"),
        ("cs2", "Counter-Strike 2"),
        ("steam", "Steam"),
    ]);
    let scenes = named(&[("soiree", "Soirée jeux")]);
    let app = |id: &str| Some(Intent::Launch(Target::App(id.into())));
    let scene = Some(Intent::Launch(Target::Scene("soiree".into())));
    let close = |id: &str| Some(Intent::Close(id.into()));
    let music = |m| Some(Intent::Music(m));
    // Hé Kayro (p, n: Windows' voice at its pace), Dis Yuna (y, m), and quicker (f, g).
    let cases: Vec<(&str, &str, Option<Intent>)> = vec![
        ("Hé Kayro", "p01", app("elden")),
        ("Hé Kayro", "p02", app("discord")),
        ("Hé Kayro", "p03", scene.clone()),
        ("Hé Kayro", "p04", close("spotify")),
        ("Hé Kayro", "p05", app("bg3")),
        ("Hé Kayro", "p06", app("cs2")),
        ("Hé Kayro", "p08", app("steam")),
        ("Hé Kayro", "n01", None),
        ("Hé Kayro", "n03", None),
        ("Hé Kayro", "n04", None),
        ("Dis Yuna", "y01", app("spotify")),
        ("Dis Yuna", "y02", app("discord")),
        ("Dis Yuna", "y03", scene.clone()),
        ("Dis Yuna", "y04", close("spotify")),
        ("Dis Yuna", "m02", music(Music::Play)),
        ("Dis Yuna", "m03", music(Music::Next)),
        ("Dis Yuna", "m04", music(Music::Quieter)),
        ("Dis Yuna", "m05", app("spotify")),
        ("Dis Yuna", "m06", app("discord")),
        ("Dis Yuna", "f01", app("spotify")),
        ("Dis Yuna", "f02", close("spotify")),
        ("Dis Yuna", "f03", app("discord")),
        ("Dis Yuna", "f06", music(Music::Next)),
        ("Dis Yuna", "f08", scene.clone()),
        ("Dis Yuna", "n07", None),
        ("Dis Yuna", "n08", None),
        ("Dis Yuna", "g01", None),
        ("Dis Yuna", "g02", None),
    ];
    let mut wrong = Vec::new();
    for (wake_word, file, want) in &cases {
        let wake = Wake::new(wake_word, &[]).unwrap();
        let hot = hotwords(wake_word, &apps, &scenes, &[]);
        let mut listener = Listener::new(&vad, &stream, wake);
        let wav = wavs.join(format!("{file}.wav"));
        let wave = sherpa_onnx::Wave::read(&wav.to_string_lossy()).expect("a 16 kHz WAV");
        assert_eq!(wave.sample_rate(), RATE, "{file}: 16 kHz expected");
        let said = hear(&mut listener, &asr, &hot, wave.samples()).said;
        let got = said.as_deref().map(|s| parse(s, &apps, &scenes));
        println!("{file}: {said:?} -> {got:?}");
        if &got != want {
            wrong.push(*file);
        }
    }
    println!("{} / {} right", cases.len() - wrong.len(), cases.len());
    assert!(wrong.is_empty(), "not as expected: {wrong:?}");
}

fn arya() -> Wake {
    Wake::new("Dis Arya", &[]).unwrap()
}

/// What follows a written wake word, without its comma.
fn after(s: &str) -> &str {
    s.trim_start_matches([',', ' '])
}

#[test]
fn the_command_starts_after_the_wake_word_said_once_or_twice() {
    let w = arya();
    assert_eq!(
        after(command_of(&w, "Dis Arya, ouvre Discord.", "")),
        "ouvre Discord."
    );
    // Said again when the aura was slow to light.
    assert_eq!(
        after(command_of(&w, "Arya, dis Arya, ferme Steam.", "")),
        "ferme Steam."
    );
    // No wake word in the text (written otherwise, or cut): from the first command verb; a
    // spelling close enough (« Darya ») is the wake word itself.
    assert_eq!(command_of(&w, "Bon euh lance Steam", ""), "lance Steam");
    assert_eq!(
        after(command_of(&w, "Darya, lance Steam", "")),
        "lance Steam"
    );
    // Neither: what the small model heard.
    assert_eq!(command_of(&w, "Bonjour", "OUVRE STEAM"), "OUVRE STEAM");
}

#[test]
fn a_second_look_wants_the_wake_word_among_the_first_two_words() {
    let w = arya();
    assert_eq!(
        second_look(&w, "Arya, ouvre Discord").map(after),
        Some("ouvre Discord")
    );
    assert!(second_look(&w, "Tu sais que Arya arrive demain").is_none());
    assert!(second_look(&w, "Ouvre Discord").is_none());
}

#[test]
fn a_sure_wake_is_trusted_and_a_doubtful_one_looked_at_again() {
    let w = arya();
    // The small model was sure: the command model's text is cut after the wake word.
    assert_eq!(
        command_in(&w, "Dis Arya, mets pause.", "METS PAUSE", true).map(after),
        Some("mets pause.")
    );
    // Not sure: only a wake word at the start makes it a command.
    assert!(command_in(&w, "On en reparle avec Arya", "", false).is_none());
    assert!(command_in(&w, "Arya, mets pause", "", false).is_some());
}

#[test]
fn a_verb_alone_waits_for_what_it_starts() {
    assert!(bare_verb("LANCE"));
    assert!(bare_verb("ouvre"));
    assert!(!bare_verb("LANCE STEAM"));
    assert!(!bare_verb("PAUSE"));
    assert!(!bare_verb(""));
}
