//! The brain's wider commands (2026-11-05): a window already open arranged or closed, the PC's
//! or one app's sound, the microphone, the last game again, Kayro's own Réglages, theme and
//! Kysland, the time, a timer, the session, a screenshot, a web search, dictation, and
//! « inconnu » (a note, nothing run). Each one is a fixed thing on a fixed target: an app of the
//! configuration, the window in front, Windows' own shortcut, one search engine.

use std::time::Duration;

use tauri::{AppHandle, Manager, Runtime};

use super::{lists, name_of, on_main, tell};
use crate::config::schema::SettingsPatch;
use crate::config::ConfigState;
use crate::media::MediaAction;
use crate::platform::{arrange, audio, system, typing};
use crate::procwatch::{ProcWatch, RunningApps};
use crate::voice::command::{Intent, Music, Target, WindowAction};
use crate::voice::VoiceOutcome;

/// The search engine (one constant; a setting later).
const SEARCH_URL: &str = "https://www.google.com/search?q=";

pub(super) fn perform<R: Runtime>(app: &AppHandle<R>, intent: Intent) -> VoiceOutcome {
    let config = app.state::<ConfigState>();
    let (apps, _, _) = lists(&config);
    match intent {
        Intent::Window { app: id, what } => window(app, id, what, &apps),
        Intent::VolumeTo(level) => {
            audio::set_master(level);
            VoiceOutcome::VolumeTo { level }
        }
        Intent::AppMusic { app: id, what } => {
            let name = name_of(&apps, &id);
            let action = match what {
                Music::Pause => MediaAction::Pause,
                Music::Next => MediaAction::Next,
                Music::Previous => MediaAction::Previous,
                _ => MediaAction::Play,
            };
            // By the app's executable first (« comet », « msedge »), else by its name.
            let exes = player_exes(app, &id);
            let found = crate::media::control_of(app, action, &exes)
                .or_else(|| crate::media::control_of(app, action, &name_words(&name)));
            match found {
                Some(_) => VoiceOutcome::Music { action: what },
                None => VoiceOutcome::NotRunning { id, name },
            }
        }
        Intent::AppVolume { app: id, what } => {
            let pids = super::pids_any(app, &id);
            let ok = !pids.is_empty() && audio::app_volume(&pids, what);
            VoiceOutcome::AppVolume {
                name: name_of(&apps, &id),
                what,
                ok,
            }
        }
        Intent::Mic(muted) => {
            let mic = config.settings().voice.microphone;
            let ok = audio::mute_microphone(&mic, muted);
            // Muted, the voice hears nothing more (not even « remets mon micro »): its own
            // microphone button goes off too, and pressing it gives Windows' microphone back
            // (ipc_voice.rs). Seen on 2026-11-05: the voice deaf for an hour.
            if muted && ok {
                crate::voice::set_muted(app, true);
            }
            VoiceOutcome::Mic { muted, ok }
        }
        Intent::LastGame => match config.ui_state().recents.first().cloned() {
            Some(id) => super::perform(app, Intent::Launch(Target::App(id)), ""),
            None => VoiceOutcome::Unknown,
        },
        Intent::Settings(page) => VoiceOutcome::Settings { page },
        Intent::Theme(id) => {
            let name = config
                .themes()
                .iter()
                .find(|t| t.id == id)
                .map(|t| t.name.clone());
            let ok = name.is_some()
                && crate::ipc::update_settings(
                    app,
                    SettingsPatch {
                        theme_id: Some(id),
                        ..Default::default()
                    },
                )
                .is_ok();
            VoiceOutcome::Theme {
                name: name.unwrap_or_default(),
                ok,
            }
        }
        Intent::Kysland(on) => {
            let patch = SettingsPatch {
                island_always: Some(on),
                ..Default::default()
            };
            if let Err(e) = crate::ipc::update_settings(app, patch) {
                tracing::warn!(error = %e.message, "voice: Kysland not changed");
            }
            VoiceOutcome::Kysland { on }
        }
        Intent::WhichSong => {
            let np = crate::media::now(app);
            VoiceOutcome::NowPlaying {
                title: np.as_ref().map(|n| n.title.clone()).unwrap_or_default(),
                artist: np.map(|n| n.artist).unwrap_or_default(),
            }
        }
        Intent::Lock => {
            system::lock();
            VoiceOutcome::Lock
        }
        Intent::Desktop => {
            system::show_desktop();
            VoiceOutcome::Desktop
        }
        Intent::Files => {
            system::file_explorer();
            VoiceOutcome::Files
        }
        Intent::Timer(minutes) => {
            timer(app, minutes);
            VoiceOutcome::Timer { minutes }
        }
        Intent::Time => {
            let (h, m) = system::local_time();
            VoiceOutcome::Time {
                text: format!("{h} h {m:02}"),
            }
        }
        Intent::Screenshot => {
            system::screenshot();
            VoiceOutcome::Screenshot
        }
        Intent::WebSearch(query) => {
            let url = format!("{SEARCH_URL}{}", encode(&query));
            if let Err(e) = crate::platform::shell::shell_execute(&url, &[], None, None) {
                tracing::warn!(error = ?e, "voice: the web search did not open");
            }
            VoiceOutcome::WebSearch { query }
        }
        Intent::SpotifySearch(query) => {
            // Spotify's own search (Spotify goes online, not Kayro), then its first « Lire ».
            let wanted = query.clone();
            let _ = std::thread::Builder::new()
                .name("voice-spotify".into())
                .spawn(move || {
                    let done =
                        crate::platform::spotify::search_and_play(&wanted, Duration::from_secs(12));
                    tracing::info!(?done, "voice: Spotify's first result");
                });
            VoiceOutcome::MusicOpened { name: query }
        }
        Intent::Dictate(text) => VoiceOutcome::Dictated {
            ok: typing::type_text(std::process::id(), &text),
        },
        // Launch, Close, Music… are act.rs' own; nothing else reaches here.
        _ => VoiceOutcome::Unknown,
    }
}

/// A window of the user's app `id`, or the one in front (`None`), arranged; closed only when it
/// belongs to one of the user's apps.
fn window<R: Runtime>(
    app: &AppHandle<R>,
    id: Option<String>,
    what: WindowAction,
    apps: &[crate::voice::command::Named],
) -> VoiceOutcome {
    let watch = app.state::<ProcWatch>();
    let own = std::process::id();
    // The window and the user's app it belongs to, if any.
    let (hwnd, id) = match id {
        Some(id) => {
            let pids = super::pids_any(app, &id);
            let hwnd = crate::platform::window::main_window(&pids);
            // Not open: « mets Discord sur l'écran 2 » opens it there, « va sur Discord » opens it.
            if hwnd.is_none() && matches!(what, WindowAction::Screen(_) | WindowAction::Front) {
                let launch = super::perform(app, Intent::Launch(Target::App(id.clone())), "");
                if let (WindowAction::Screen(n), VoiceOutcome::Launched { .. }) = (what, &launch) {
                    super::on_screen(app, id, n);
                }
                return launch;
            }
            (hwnd, Some(id))
        }
        None => match arrange::front(own) {
            Some((hwnd, pid)) => {
                let id = apps
                    .iter()
                    .find(|a| watch.pids_of(&a.id).contains(&pid))
                    .map(|a| a.id.clone());
                (Some(hwnd), id)
            }
            None => (None, None),
        },
    };
    let name = id.as_deref().map(|i| name_of(apps, i)).unwrap_or_default();
    let label = match what {
        WindowAction::Screen(_) => "ecran",
        WindowAction::Maximize => "plein",
        WindowAction::Minimize => "reduire",
        WindowAction::Restore => "restaurer",
        WindowAction::Front => "devant",
        WindowAction::Left => "gauche",
        WindowAction::Right => "droite",
        WindowAction::Close => "fermer",
    };
    let ok = match (hwnd, what) {
        (None, _) => false,
        // Only the user's own apps are asked to close (gently: the app may still ask to save).
        (Some(_), WindowAction::Close) => match &id {
            Some(i) => {
                let pids = super::pids_any(app, i);
                crate::voice::memory::closed(i);
                !pids.is_empty() && watch.close_softly(&pids)
            }
            None => false,
        },
        (Some(_), WindowAction::Front) => match &id {
            Some(i) => crate::platform::window::bring_to_front(&super::pids_any(app, i)),
            None => true,
        },
        (Some(h), WindowAction::Screen(n)) => arrange::arrange(h, arrange::Arrange::Screen(n)),
        (Some(h), WindowAction::Maximize) => arrange::arrange(h, arrange::Arrange::Maximize),
        (Some(h), WindowAction::Minimize) => arrange::arrange(h, arrange::Arrange::Minimize),
        (Some(h), WindowAction::Restore) => arrange::arrange(h, arrange::Arrange::Restore),
        (Some(h), WindowAction::Left) => arrange::arrange(h, arrange::Arrange::Left),
        (Some(h), WindowAction::Right) => arrange::arrange(h, arrange::Arrange::Right),
    };
    VoiceOutcome::Window {
        what: label.into(),
        name,
        ok,
    }
}

/// A note when `minutes` have passed (Kayro comes to show it).
fn timer<R: Runtime>(app: &AppHandle<R>, minutes: u32) {
    let app = app.clone();
    let _ = std::thread::Builder::new()
        .name("voice-timer".into())
        .spawn(move || {
            std::thread::sleep(Duration::from_secs(u64::from(minutes) * 60));
            tell(&app, "", VoiceOutcome::TimerDone { minutes }, Vec::new());
            on_main(&app, |app| crate::desktop::show(app));
        });
}

/// `query` as a URL's query part: letters, digits and a few marks as they are, the rest in
/// percent form (a space as « + »).
fn encode(query: &str) -> String {
    let mut out = String::new();
    for b in query.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// The executables of an app that runs, lower case and without « .exe » (how Windows names
/// their players: `Comet.…`, `MSEdge`).
fn player_exes<R: Runtime>(app: &AppHandle<R>, id: &str) -> Vec<String> {
    let mut exes: Vec<String> = super::pids_any(app, id)
        .into_iter()
        .filter_map(crate::platform::process::exe_name)
        .map(|e| e.trim_end_matches(".exe").to_string())
        .filter(|e| e.len() >= 3)
        .collect();
    exes.sort();
    exes.dedup();
    exes
}

/// The words of an app's name that can name its player (not « Microsoft », « Player »…).
fn name_words(name: &str) -> Vec<String> {
    const VAGUE: &[&str] = &[
        "microsoft",
        "windows",
        "player",
        "media",
        "music",
        "raccourci",
    ];
    name.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.chars().count() >= 4 && !VAGUE.contains(w))
        .map(String::from)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_player_is_named_by_the_words_of_its_app() {
        assert_eq!(name_words("Comet"), ["comet"]);
        assert_eq!(name_words("Spotify (raccourci)"), ["spotify"]);
        assert!(name_words("Microsoft Media Player").is_empty());
    }

    #[test]
    fn a_query_is_encoded_for_the_url() {
        assert_eq!(encode("météo à Paris"), "m%C3%A9t%C3%A9o+%C3%A0+Paris");
        assert_eq!(encode("a&b=c"), "a%26b%3Dc");
    }
}
