//! The brain on the user's own world (ignored tests: they need the brain's files and
//! `KAYRO_VOICE_CONFIG`, a copy of Kayro's data folder): free sentences and follow-ups, each
//! straight to the brain with Kayro's own prompt and context; the new families of commands
//! (windows, sound, Réglages, the timer…) go through the same harness with their own folders.

use std::path::PathBuf;

use crate::voice::calib::key;
use crate::voice::calib::user_tests::{user, User};
use crate::voice::command::Named;

/// Free speech (`KAYRO_VOICE_FREE`: WAV files and `expected.tsv`, « key<TAB>sentence<TAB>
/// app:id@screen,music:pause… » or « none », then two optional columns: the app in front and the
/// apps open, « discord » and « discord,steam »), each sentence straight to the brain
/// (`KAYRO_VOICE_BRAIN`) with Kayro's own prompt and context, two screens: every action must
/// match.
#[test]
#[ignore]
fn brain_understands_free_speech() {
    use crate::voice::brain::{prompt, Brain};
    let User {
        voice,
        brain_apps: apps,
        scenes,
        links,
        ..
    } = user();
    let free = PathBuf::from(std::env::var_os("KAYRO_VOICE_FREE").expect("KAYRO_VOICE_FREE"));
    let dir = std::env::var_os("KAYRO_VOICE_BRAIN").expect("KAYRO_VOICE_BRAIN");
    let brain = Brain::start(std::path::Path::new(&dir)).expect("brain");
    let themes: Vec<Named> = ["bleu-gris", "cuivre", "encre", "opale", "sakura"]
        .iter()
        .map(|id| Named {
            id: (*id).into(),
            name: {
                let mut c = id.chars();
                c.next()
                    .map(|f| f.to_uppercase().chain(c).collect())
                    .unwrap_or_default()
            },
        })
        .collect();
    let world = prompt::World {
        wake_word: &voice.wake_word,
        apps: &apps,
        scenes: &scenes,
        links: &links,
        themes: &themes,
        screens: 2,
    };
    let (system, grammar) = (prompt::system(&world), prompt::grammar(&world));
    let tsv = std::fs::read_to_string(free.join("expected.tsv")).unwrap();
    let (mut right, mut total, mut times) = (0, 0, Vec::new());
    for line in tsv.lines().filter(|l| !l.trim().is_empty()) {
        let cols: Vec<&str> = line.split('\t').collect();
        let (key_, text, want) = (cols[0], cols[1], cols[2]);
        let seen = seen_from(cols.get(3).copied(), cols.get(4).copied());
        let hint = prompt::hint(&prompt::FollowUp::None, &voice.wake_word, &seen);
        let wave = sherpa_onnx::Wave::read(&free.join(format!("{key_}.wav")).to_string_lossy())
            .expect("wav");
        let started = std::time::Instant::now();
        let raw = brain
            .ask(&system, &grammar, wave.samples(), hint.as_deref())
            .unwrap_or_default();
        let answer = prompt::answer(&raw, &world);
        times.push(started.elapsed().as_millis());
        let front = cols.get(3).map(|f| f.trim()).filter(|f| !f.is_empty());
        let got: Vec<String> = if !answer.called {
            vec!["none".into()]
        } else if answer.actions.is_empty() {
            vec!["inconnu".into()]
        } else {
            answer
                .actions
                .iter()
                .map(|a| match a.screen {
                    Some(n) => format!("{}@{n}", key(&a.intent)),
                    None => key(&a.intent),
                })
                // « devant » is the app in front when the context names it (as act.rs resolves it).
                .map(|k| match front {
                    Some(f) => k.replace("window:devant:", &format!("window:{f}:")),
                    None => k,
                })
                .collect()
        };
        let ok = got.join(",") == want;
        total += 1;
        right += usize::from(ok);
        let mark = if ok { "ok" } else { "XX" };
        println!(
            "{mark} {key_} « {text} » -> {} (want {want})",
            got.join(",")
        );
    }
    times.sort_unstable();
    println!(
        "free speech: {right}/{total} right, median {} ms",
        times[times.len() / 2]
    );
}

/// A context as the harness files give it: the app in front (empty: none) and the apps open.
fn seen_from(front: Option<&str>, open: Option<&str>) -> crate::voice::brain::prompt::Context {
    use crate::voice::brain::prompt::{Context, Front};
    let open: Vec<String> = open
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect();
    let front = front.filter(|f| !f.trim().is_empty()).map(|f| Front {
        app: Some(f.trim().to_string()),
        exe: String::new(),
        title: String::new(),
        screen: Some(1),
    });
    Context { front, open }
}

/// Follow-ups without the name (`KAYRO_VOICE_FOLLOW`: WAV files and `expected.tsv`, « key<TAB>what
/// was just done (the brain's lines)<TAB>sentence<TAB>expected »): each told to the brain as
/// following what was done.
#[test]
#[ignore]
fn brain_follows_a_conversation() {
    use crate::voice::brain::{prompt, Brain};
    let User {
        voice,
        brain_apps: apps,
        scenes,
        links,
        ..
    } = user();
    let dir_ = PathBuf::from(std::env::var_os("KAYRO_VOICE_FOLLOW").expect("KAYRO_VOICE_FOLLOW"));
    let dir = std::env::var_os("KAYRO_VOICE_BRAIN").expect("KAYRO_VOICE_BRAIN");
    let brain = Brain::start(std::path::Path::new(&dir)).expect("brain");
    let world = prompt::World {
        wake_word: &voice.wake_word,
        apps: &apps,
        scenes: &scenes,
        links: &links,
        themes: &[],
        screens: 2,
    };
    let (system, grammar) = (prompt::system(&world), prompt::grammar(&world));
    let tsv = std::fs::read_to_string(dir_.join("expected.tsv")).unwrap();
    let (mut right, mut total) = (0, 0);
    for line in tsv.lines().filter(|l| !l.trim().is_empty()) {
        let cols: Vec<&str> = line.split('\t').collect();
        let (key_, done, text, want) = (cols[0], cols[1], cols[2], cols[3]);
        let wave =
            sherpa_onnx::Wave::read(&dir_.join(format!("{key_}.wav")).to_string_lossy()).unwrap();
        let hint = prompt::hint(
            &prompt::FollowUp::After(done.into()),
            &voice.wake_word,
            &prompt::Context::default(),
        );
        let raw = brain
            .ask(&system, &grammar, wave.samples(), hint.as_deref())
            .unwrap_or_default();
        let follow = prompt::FollowUp::After(done.into());
        let answer = prompt::answer_after(&raw, &world, &follow);
        let got: Vec<String> = answer
            .actions
            .iter()
            .map(|a| match a.screen {
                Some(n) => format!("{}@{n}", key(&a.intent)),
                None => key(&a.intent),
            })
            .collect();
        let got = if got.is_empty() {
            "none".to_string()
        } else {
            got.join(",")
        };
        let ok = got == want;
        total += 1;
        right += usize::from(ok);
        let mark = if ok { "ok" } else { "XX" };
        println!("{mark} {key_} after « {done} »: « {text} » -> {got} (want {want})");
    }
    println!("follow-ups: {right}/{total} right");
}
