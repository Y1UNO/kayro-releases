//! The user's own data (ignored tests: they need it, and the models). `KAYRO_VOICE_CONFIG`: a copy
//! of Kayro's data folder (settings.json, apps.json, scenes/); `KAYRO_VOICE_ME`: the calibration's
//! recordings; `KAYRO_VOICE_MODELS`: the models.

use std::path::PathBuf;

use super::*;
use crate::config::schema::{VoiceModel, VoiceSettings};
use crate::voice::command::{self, Named};
use crate::voice::engine;
use crate::voice::wake::Wake;

pub(crate) struct User {
    pub(crate) voice: VoiceSettings,
    pub(crate) apps: Vec<Named>,
    /// The apps as the brain is told them (brain/apps.rs), as Kayro makes them from apps.json.
    pub(crate) brain_apps: Vec<Named>,
    pub(crate) scenes: Vec<Named>,
    pub(crate) links: Vec<Named>,
}

/// The user's settings (as Kayro reads them: a field missing takes its default), apps and scenes.
pub(crate) fn user() -> User {
    let config = PathBuf::from(std::env::var_os("KAYRO_VOICE_CONFIG").expect("KAYRO_VOICE_CONFIG"));
    let read = |name: &str| -> serde_json::Value {
        serde_json::from_slice(&std::fs::read(config.join(name)).unwrap()).unwrap()
    };
    let settings = read("settings.json");
    let mut voice = serde_json::to_value(VoiceSettings::default()).unwrap();
    if let (Some(v), Some(given)) = (voice.as_object_mut(), settings["voice"].as_object()) {
        v.extend(given.clone());
    }
    let mut voice: VoiceSettings = serde_json::from_value(voice).unwrap();
    // `KAYRO_VOICE_ECHO=0`: the speakers' echo left in (to compare).
    if let Some(e) = std::env::var_os("KAYRO_VOICE_ECHO") {
        voice.echo_cancel = e == "1";
    }
    // `KAYRO_VOICE_WAKE`: another wake word (recordings made with it).
    if let Some(w) = std::env::var_os("KAYRO_VOICE_WAKE") {
        voice.wake_word = w.to_string_lossy().into_owned();
        voice.wake_heard.clear();
    }
    let named = |v: &serde_json::Value, id: &str, name: &str| Named {
        id: v[id].as_str().unwrap_or_default().into(),
        name: v[name].as_str().unwrap_or_default().into(),
    };
    let all = read("apps.json")["apps"].as_array().unwrap().clone();
    let apps = all.iter().map(|a| named(a, "id", "name")).collect();
    let known: Vec<crate::voice::brain::apps::Known> = all
        .iter()
        .map(|a| crate::voice::brain::apps::Known {
            id: a["id"].as_str().unwrap_or_default(),
            name: a["name"].as_str().unwrap_or_default(),
            category: a["category"].as_str().unwrap_or_default(),
            store_game: matches!(a["source"]["kind"].as_str(), Some("steam" | "epic")),
            favorite: a["favorite"].as_bool().unwrap_or(false),
        })
        .collect();
    // `KAYRO_VOICE_PLAIN_APPS=1`: the brain told every app by its name only, as before 2026-11-05.
    let brain_apps = if std::env::var_os("KAYRO_VOICE_PLAIN_APPS").is_some() {
        all.iter().map(|a| named(a, "id", "name")).collect()
    } else {
        crate::voice::brain::apps::spoken(&known).apps
    };
    let scenes = std::fs::read_dir(config.join("scenes"))
        .map(|d| {
            d.flatten()
                .filter_map(|f| std::fs::read(f.path()).ok())
                .filter_map(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
                .map(|v| named(&v, "id", "name"))
                .collect()
        })
        .unwrap_or_default();
    let links = voice
        .links
        .iter()
        .map(|l| Named {
            id: l.uri.clone(),
            name: l.name.clone(),
        })
        .collect();
    User {
        voice,
        apps,
        brain_apps,
        scenes,
        links,
    }
}

/// The user's own recordings (`KAYRO_VOICE_ME`, else `%APPDATA%/Kayro/voice/me`) through the
/// whole always mode, with their settings and apps as `KAYRO_VOICE_CONFIG` (Kayro's data folder)
/// has them. What Claude tunes on: `cargo test -p hub --release calibration -- --ignored
/// --nocapture`.
#[test]
#[ignore]
fn calibration_recordings_score() {
    let models =
        std::env::var_os("KAYRO_VOICE_MODELS").map_or_else(engine::voice_dir, PathBuf::from);
    let me = std::env::var_os("KAYRO_VOICE_ME").map_or_else(dir, PathBuf::from);
    let User {
        voice,
        apps,
        brain_apps,
        scenes,
        links,
    } = user();
    let (vad, stream) = (
        engine::vad(&models).unwrap(),
        engine::wake(&models).unwrap(),
    );
    let asr = engine::command(&models, voice.model)
        .unwrap_or_else(|_| engine::command(&models, VoiceModel::Parakeet).unwrap());
    let lists = Lists {
        apps: &apps,
        brain_apps: &brain_apps,
        scenes: &scenes,
        links: &links,
    };
    let speaker = engine::speaker(&models).ok();
    // `KAYRO_VOICE_BRAIN`: the brain's folder (llama/, the model): each sentence judged by it.
    let brain = std::env::var_os("KAYRO_VOICE_BRAIN")
        .map(|d| crate::voice::brain::Brain::start(std::path::Path::new(&d)).expect("brain"));
    let ears = Ears {
        vad: &vad,
        stream: &stream,
        asr: &asr,
        speaker: speaker.as_ref(),
        brain: brain.as_ref(),
    };
    let score = evaluate(ears, &voice, &lists, &|_| None, &me).unwrap();
    for r in &score.results {
        let mark = if r.right { "ok " } else { "XX " };
        println!(
            "{mark}{:<10} {:?} « {} » heard « {} » -> {} (woke {})",
            r.key, r.kind, r.text, r.heard, r.got, r.woke
        );
    }
    println!(
        "wake {:?} commands {:?} music {:?} calm {:?} voice {:?} median {} ms, learned {:?}",
        score.wake,
        score.commands,
        score.music,
        score.calm,
        score.voice,
        score.median_ms,
        score.learned
    );
    // Other voices (`KAYRO_VOICE_OTHERS`: folders of WAV, one per voice) against the voiceprint.
    let (Some(x), Some(others)) = (speaker.as_ref(), std::env::var_os("KAYRO_VOICE_OTHERS")) else {
        return;
    };
    let print = crate::voice::speaker::load(&me).expect("a voiceprint");
    println!("voiceprint: threshold {:.3}", print.threshold);
    let mut voices: Vec<_> = std::fs::read_dir(others).unwrap().flatten().collect();
    voices.sort_by_key(|d| d.file_name());
    for d in voices.iter().filter(|d| d.path().is_dir()) {
        let mut scores = Vec::new();
        for f in std::fs::read_dir(d.path()).unwrap().flatten() {
            let Some(w) = sherpa_onnx::Wave::read(&f.path().to_string_lossy()) else {
                continue;
            };
            scores.push(crate::voice::speaker::is_me(x, &print, w.samples()).1);
        }
        let taken = scores.iter().filter(|&&s| s >= print.threshold).count();
        let top = scores.iter().cloned().fold(f32::MIN, f32::max);
        println!(
            "  {:<10} taken for the user {taken} / {} (highest {top:.3})",
            d.file_name().to_string_lossy(),
            scores.len()
        );
    }
}

/// The sentences the guided screen asks for (src/i18n/fr-settings.json) do what it expects.
#[test]
fn the_guided_sentences_do_what_the_screen_expects() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/i18n/fr-settings.json");
    let all: serde_json::Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    let say = &all["settings"]["voice"]["calib"]["say"];
    let n = |id: &str, name: &str| Named {
        id: id.into(),
        name: name.into(),
    };
    let apps = [
        n("discord", "Discord"),
        n("steam", "Steam"),
        n("elden", "Elden Ring"),
    ];
    let scenes = [n("soiree", "Soirée jeux")];
    let uri = "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M";
    let links = [n(uri, "Chill")];
    let cases = [
        ("open", "app:discord"),
        ("launch", "app:discord"),
        ("close", "close:discord"),
        ("scene", "scene:soiree"),
        ("play", "music:play"),
        ("pause", "music:pause"),
        ("next", "music:next"),
        ("louder", "music:louder"),
        ("quieter", "music:quieter"),
        ("linkPlaylist", "link:"),
        ("linkAlbum", "link:"),
        ("linkTrack", "link:"),
        ("linkOther", "link:"),
        ("show", "show"),
        ("hide", "hide"),
        ("search", "search"),
        ("musicMode", "musicmode:on"),
    ];
    for (id, want) in cases {
        let text = say[id].as_str().unwrap_or_else(|| panic!("{id}"));
        let command = text
            .replace("{word}, ", "")
            .replace("{target}", "Discord")
            .replace("{scene}", "Soirée jeux")
            .replace("{link}", "Chill");
        let got = key(&command::parse_with(&command, &apps, &scenes, &links, &|_| None).intent);
        let want = if want == "link:" {
            format!("link:{uri}")
        } else {
            want.to_string()
        };
        assert_eq!(got, want, "{id}: « {command} »");
    }
    // The traps have no sure wake word in them (« une » may sound like « Yuna »: only a
    // second look by the command model could wake it).
    let wake = Wake::new("Dis Yuna", &[]).unwrap();
    for i in 1..=5 {
        let text = say[format!("trap{i}")].as_str().unwrap();
        assert!(wake.find(&text.to_uppercase()).is_none(), "trap{i}");
    }
}

/// What a model wrote of each recording (`KAYRO_VOICE_TRANSCRIPTS`: the GPU benchmark's JSON),
/// judged by Kayro's rules as if Parakeet had written it: wake word, then the command.
#[test]
#[ignore]
fn transcripts_score() {
    let User {
        voice,
        apps,
        scenes,
        links,
        ..
    } = user();
    let path = std::env::var_os("KAYRO_VOICE_TRANSCRIPTS").expect("KAYRO_VOICE_TRANSCRIPTS");
    let all: serde_json::Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    let wake = Wake::new(&voice.wake_word, &voice.wake_heard).unwrap();
    let (mut cmd, mut cmd_ok, mut calm, mut calm_ok, mut woke, mut woke_ok) = (0, 0, 0, 0, 0, 0);
    for r in all["results"].as_array().unwrap() {
        let text = r["written"].as_str().unwrap_or_default();
        let (kind, expect) = (r["kind"].as_str().unwrap(), r["expect"].as_str().unwrap());
        let sure = wake.find(text).is_some();
        let said = crate::voice::phrase::command_in(&wake, text, "", sure);
        let got = said.map_or_else(
            || "none".to_string(),
            |s| key(&command::parse_with(s, &apps, &scenes, &links, &|_| None).intent),
        );
        let right = match kind {
            "wake" | "name" => said.is_some(),
            "trap" | "chat" => said.is_none(),
            _ => got == expect,
        };
        match kind {
            "trap" | "chat" => {
                calm += 1;
                calm_ok += usize::from(right);
            }
            "wake" | "name" => {
                woke += 1;
                woke_ok += usize::from(right);
            }
            _ => {
                woke += 1;
                woke_ok += usize::from(said.is_some());
                cmd += 1;
                cmd_ok += usize::from(right);
            }
        }
        let mark = if right { "ok" } else { "XX" };
        println!(
            "{mark} {:<12} « {text} » -> {got}",
            r["key"].as_str().unwrap()
        );
    }
    println!("rules on these words: wake {woke_ok}/{woke}, commands {cmd_ok}/{cmd}, calm {calm_ok}/{calm}");
}
