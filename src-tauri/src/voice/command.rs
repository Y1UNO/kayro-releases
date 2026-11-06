//! What a command asks, from what was heard after the wake word. Only Kayro's own apps, scenes
//! and actions come out of it, by id: a sentence can never start anything else (CLAUDE.md).

mod vocab;

use super::wake::{key, levenshtein, words};
pub use vocab::{hotwords, normalize, verb_start, wake_part};
use vocab::{is_verb, music, polite, says, CLOSE, FILLER, HIDE, LAUNCH, MUSIC_WORDS, SEARCH, STOP};

/// An app or a scene of the configuration (its id and the name the user sees).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Named {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Target {
    App(String),
    Scene(String),
}

/// What the voice does to the music playing (Windows' media controls: Spotify or any player).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum Music {
    Play,
    Pause,
    Next,
    Previous,
    Louder,
    Quieter,
    Mute,
    ShuffleOn,
    ShuffleOff,
    RepeatOn,
    RepeatOff,
}

/// What is done to a window already open (`Intent::Window`; platform/arrange.rs).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowAction {
    /// Put on screen `n` (1 = the first), without relaunching.
    Screen(u32),
    /// « Plein écran »: maximized.
    Maximize,
    Minimize,
    Restore,
    /// Brought to the front.
    Front,
    Left,
    Right,
    /// Closed gently (WM_CLOSE), the user's apps only.
    Close,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Intent {
    Launch(Target),
    /// A gentle close at once (a close message to its window, never forced): the user asked
    /// (2026-11-04: no confirmation for a spoken « ferme X »).
    Close(String),
    Music(Music),
    /// Kysland's music mode on (`true`) or off.
    MusicMode(bool),
    /// The hands (step 22, the mouse in the air): the camera on (`true`) or off.
    Hands(bool),
    /// A piece of music the user named in Réglages (its Spotify address, checked there).
    Link(String),
    ShowKayro,
    HideKayro,
    /// Kayro's search, with what to look for.
    Search(String),
    StopListening,
    /// Several apps or scenes sound like it: the island proposes them, nothing starts.
    Doubt(Vec<Target>),
    NotUnderstood,
    /// A window of the user's app `app` (`None`: the one in front), arranged or closed.
    Window {
        app: Option<String>,
        what: WindowAction,
    },
    /// The PC's volume to a level (0–100).
    VolumeTo(u8),
    /// One app's own player: play, pause, next or previous (« mets play sur Comet »).
    AppMusic {
        app: String,
        what: Music,
    },
    /// One app's own sound (the user's apps only).
    AppVolume {
        app: String,
        what: crate::platform::audio::AppVolume,
    },
    /// The user's microphone muted (`true`) or not.
    Mic(bool),
    /// The last app launched from Kayro, again.
    LastGame,
    /// Réglages opened on a page (a fixed list, brain/prompt.rs).
    Settings(String),
    /// Another of the installed themes.
    Theme(String),
    /// « Kysland toujours à l'écran » on or off.
    Kysland(bool),
    /// What plays, shown in a note.
    WhichSong,
    Lock,
    Desktop,
    /// File Explorer opened (the Win+E shortcut): « ouvre l'explorateur de fichiers ».
    Files,
    /// A timer of this many minutes (a note when it ends).
    Timer(u32),
    Time,
    /// A screenshot, as Windows takes it on Win+Impr (saved by Windows in Images\Captures).
    Screenshot,
    /// « Cherche … sur internet »: the default browser on the search engine, with these words.
    WebSearch(String),
    /// « Mets One More Time de Daft Punk »: searched in Spotify, its first result played
    /// (platform/spotify.rs). Not the user's own music (`Link`).
    SpotifySearch(String),
    /// « Écris … »: typed into the field in front (never into a console, never a key).
    Dictate(String),
    /// Said to the assistant, but nothing Kayro can do: a note says so, nothing runs.
    Unknown,
}

fn similarity(a: &str, b: &str) -> f32 {
    let longest = a.chars().count().max(b.chars().count()).max(1);
    1.0 - levenshtein(a, b) as f32 / longest as f32
}

/// How much `heard` sounds like `name` (0–1): spelled, or by its French sounds, or as the start
/// of the name (« lance Elden » for Elden Ring).
fn score(heard: &str, name: &str) -> f32 {
    let (h, n) = (
        normalize(heard).replace(' ', ""),
        normalize(name).replace(' ', ""),
    );
    if h.is_empty() || n.is_empty() {
        return 0.0;
    }
    let sounds = |t: &str| -> String {
        let t = normalize(t);
        words(&t).iter().map(|&(s, e)| key(&t[s..e])).collect()
    };
    let spelled = similarity(&h, &n);
    let sounded = similarity(&sounds(heard), &sounds(name));
    let start = if h.len() >= 4 && n.starts_with(&h) {
        0.85
    } else {
        0.0
    };
    spelled.max(sounded).max(start).max(by_words(heard, name))
}

/// The name's first words (« OBS » for OBS Studio), or its initials then its other words (« VS
/// Code » for Visual Studio Code).
fn by_words(heard: &str, name: &str) -> f32 {
    let heard = normalize(heard);
    let name = normalize(name);
    let ws: Vec<&str> = name.split_whitespace().collect();
    if heard.len() < 2 || ws.len() < 2 {
        return 0.0;
    }
    if name.starts_with(&format!("{heard} ")) {
        return 0.85;
    }
    let short = (2..=ws.len()).any(|i| {
        let initials: String = ws[..i].iter().filter_map(|w| w.chars().next()).collect();
        let rest = ws[i..].join(" ");
        let alt = if rest.is_empty() {
            initials
        } else {
            format!("{initials} {rest}")
        };
        alt == heard || alt.replace(' ', "") == heard.replace(' ', "")
    });
    if short {
        0.9
    } else {
        0.0
    }
}

const SURE: f32 = 0.75;
const MAYBE: f32 = 0.55;
const MARGIN: f32 = 0.08;

/// The app or scene `heard` names: one clearly ahead, or a few to choose from.
fn pick(heard: &str, apps: &[Named], scenes: &[Named], scene_first: bool) -> Intent {
    // A first word the model squashed (« uvo » for « ouvre » said quickly) may stand before the
    // name: it is also scored without it.
    let tail = heard
        .split_once(' ')
        .map(|(_, t)| t)
        .filter(|t| !t.is_empty());
    let best_of = |name: &str| {
        let whole = score(heard, name);
        tail.map_or(whole, |t| whole.max(score(t, name) - 0.02))
    };
    let mut all: Vec<(f32, Target)> = apps
        .iter()
        .map(|a| (best_of(&a.name), Target::App(a.id.clone())))
        .chain(scenes.iter().map(|s| {
            let bonus = if scene_first { 0.1 } else { 0.0 };
            (best_of(&s.name) + bonus, Target::Scene(s.id.clone()))
        }))
        .collect();
    all.sort_by(|a, b| b.0.total_cmp(&a.0));
    match all.as_slice() {
        [(best, t), rest @ ..]
            if *best >= SURE && rest.first().is_none_or(|r| r.0 < best - MARGIN) =>
        {
            Intent::Launch(t.clone())
        }
        [(best, _), ..] if *best >= MAYBE => Intent::Doubt(
            all.iter()
                .filter(|(s, _)| *s >= MAYBE)
                .take(3)
                .map(|(_, t)| t.clone())
                .collect(),
        ),
        _ => Intent::NotUnderstood,
    }
}

/// What a command asks, and the words that named its target, normalized (what the memory keeps:
/// « mon jeu de foot », « disco »).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Parsed {
    pub intent: Intent,
    pub said: String,
}

/// The intent of a command (the words after the wake word, or all of a push-to-talk phrase).
#[cfg(test)]
pub fn parse(text: &str, apps: &[Named], scenes: &[Named]) -> Intent {
    parse_with(text, apps, scenes, &[], &|_| None).intent
}

/// `parse`, with what the user's own way of naming things taught Kayro (`recall`: memory.rs),
/// tried before any guess, and only for an app or a scene that is still there.
pub fn parse_with(
    text: &str,
    apps: &[Named],
    scenes: &[Named],
    links: &[Named],
    recall: &dyn Fn(&str) -> Option<Target>,
) -> Parsed {
    let plain = |intent| Parsed {
        intent,
        said: String::new(),
    };
    let said = polite(&normalize(text));
    if STOP.iter().any(|s| said.contains(s)) {
        return plain(Intent::StopListening);
    }
    // Step 22: « active les mains », « coupe les mains », « mode main ».
    let hands = [
        "les mains",
        "mode main",
        "mode mains",
        "controle par les mains",
    ];
    if hands.iter().any(|p| says(&said, p)) {
        let off = [
            "arrete",
            "coupe",
            "desactive",
            "enleve",
            "eteins",
            "sans",
            "quitte",
            "ferme",
            "stop",
        ];
        return plain(Intent::Hands(!off.iter().any(|w| says(&said, w))));
    }
    if ["explorateur", "mes fichiers", "mes dossiers"]
        .iter()
        .any(|p| says(&said, p))
    {
        return plain(Intent::Files);
    }
    if says(&said, "mode musique") {
        let off = [
            "arrete",
            "coupe",
            "desactive",
            "enleve",
            "eteins",
            "sans",
            "quitte",
            "ferme",
        ];
        return plain(Intent::MusicMode(!off.iter().any(|w| says(&said, w))));
    }
    if let Some(m) = music(&said) {
        return plain(Intent::Music(m));
    }
    let mut ws: Vec<&str> = said.split_whitespace().collect();
    // Polite or indirect (« tu peux ouvrir… », « je veux jouer à… », « allez, lance… »): from
    // the first command verb among the first six words.
    if let Some(i) = ws.iter().take(6).position(|w| is_verb(w)) {
        ws.drain(..i);
    }
    let Some(&verb) = ws.first() else {
        return plain(Intent::NotUnderstood);
    };
    let is = |list: &[&str]| list.contains(&verb);
    let kind = if is(LAUNCH) {
        Some("launch")
    } else if is(CLOSE) {
        Some("close")
    } else if is(HIDE) {
        Some("hide")
    } else if is(SEARCH) {
        Some("search")
    } else {
        None
    };
    if kind.is_some() {
        ws.remove(0);
    }
    if kind == Some("search") {
        return plain(Intent::Search(ws.join(" ")));
    }
    let scene_first = ws.iter().any(|w| *w == "scene" || *w == "scenes");
    ws.retain(|w| !FILLER.contains(w) && *w != "scene" && *w != "scenes");
    let musical = ws.iter().any(|w| MUSIC_WORDS.contains(w));
    if musical {
        ws.retain(|w| !MUSIC_WORDS.contains(w) && !["ma", "mon", "mes", "ta"].contains(w));
    }
    let rest = ws.join(" ");
    // The user's music: first when they said « playlist », « album »…, else when it sounds more
    // like it than any app or scene.
    let link = links
        .iter()
        .map(|l| (score(&rest, &l.name), l))
        .max_by(|a, b| a.0.total_cmp(&b.0));
    let top = apps
        .iter()
        .chain(scenes)
        .map(|n| score(&rest, &n.name))
        .fold(0.0_f32, f32::max);
    let link = link
        .filter(|(s, _)| (musical && *s >= MAYBE) || (*s >= SURE && *s > top))
        .map(|(_, l)| l.id.clone());
    let about_kayro = !rest.is_empty() && score(&rest, "Kayro") >= SURE;
    let known = |t: &Target| match t {
        Target::App(id) => apps.iter().any(|a| &a.id == id),
        Target::Scene(id) => scenes.iter().any(|s| &s.id == id),
    };
    let remembered = recall(&rest).filter(known);
    let intent = match kind {
        Some("hide") if rest.is_empty() || about_kayro || rest == "toi" => Intent::HideKayro,
        // « Cache Discord »: its window reduced (its « – » button), not Kayro.
        Some("hide") => match pick(&rest, apps, &[], false) {
            Intent::Launch(Target::App(id)) => Intent::Window {
                app: Some(id),
                what: WindowAction::Minimize,
            },
            _ => Intent::HideKayro,
        },
        Some("close") if about_kayro => Intent::HideKayro,
        Some("launch") if about_kayro => Intent::ShowKayro,
        _ if rest.is_empty() => Intent::NotUnderstood,
        Some("close") => match remembered.filter(|t| matches!(t, Target::App(_))) {
            Some(Target::App(id)) => Intent::Close(id),
            _ => match pick(&rest, apps, &[], false) {
                Intent::Launch(Target::App(id)) => Intent::Close(id),
                other => other,
            },
        },
        _ => match (link, remembered) {
            (Some(uri), _) => Intent::Link(uri),
            (None, Some(t)) => Intent::Launch(t),
            (None, None) => pick(&rest, apps, scenes, scene_first),
        },
    };
    Parsed { intent, said: rest }
}

#[cfg(test)]
mod phrasings;
#[cfg(test)]
mod tests;
