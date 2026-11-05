//! What a command does: an app of the configuration is launched (as from the hub), a scene
//! starts (as from its shortcut: one that closes apps asks first), « ferme X » closes it gently at
//! once (a close message to its window: the app may still ask to save; never forced), the music
//! plays, pauses, skips or gets louder, Kysland's music mode turns on or off, Kayro shows, hides
//! or opens its search. The page is told every time (`VoiceHeard`). The sentence itself is never
//! written to the logs.

use tauri::{AppHandle, Manager, Runtime};
use tauri_specta::Event;

use std::time::Duration;

mod extra;

use super::command::{self, Intent, Music, Named, Target};
use super::memory;
use super::{VoiceCandidate, VoiceHeard, VoiceOutcome};
use crate::config::schema::SettingsPatch;
use crate::config::ConfigState;
use crate::launcher::launch_app;
use crate::launcher::system::SystemLauncher;
use crate::media::MediaAction;
use crate::platform::keys::{self, Volume};
use crate::procwatch::{ProcWatch, RunningApps};

pub(super) fn name_of(list: &[Named], id: &str) -> String {
    list.iter()
        .find(|n| n.id == id)
        .map(|n| n.name.clone())
        .unwrap_or_default()
}

/// What plays: the player shown by Windows. With none, « mets la musique » starts Spotify (when
/// it is one of Kayro's apps) and plays as soon as it is up (12 s at most).
fn music<R: Runtime>(app: &AppHandle<R>, m: Music) {
    let control = |a| crate::media::control(app, a);
    match m {
        Music::Louder => keys::volume(Volume::Up, 5),
        Music::Quieter => keys::volume(Volume::Down, 5),
        Music::Mute => keys::volume(Volume::Mute, 1),
        Music::Pause => drop(control(MediaAction::Pause)),
        Music::Next => drop(control(MediaAction::Next)),
        Music::Previous => drop(control(MediaAction::Previous)),
        Music::ShuffleOn => drop(control(MediaAction::Shuffle(true))),
        Music::ShuffleOff => drop(control(MediaAction::Shuffle(false))),
        Music::RepeatOn => drop(control(MediaAction::Repeat(true))),
        Music::RepeatOff => drop(control(MediaAction::Repeat(false))),
        Music::Play if control(MediaAction::Play) => {}
        Music::Play => {
            let config = app.state::<ConfigState>();
            let Some(spotify) = config
                .apps()
                .apps
                .into_iter()
                .find(|a| a.name.to_lowercase().contains("spotify"))
            else {
                return;
            };
            let watch = app.state::<ProcWatch>();
            if launch_app(&SystemLauncher, &*watch, &spotify).is_err() {
                return;
            }
            let app = app.clone();
            let _ = std::thread::Builder::new()
                .name("voice-play".into())
                .spawn(move || {
                    for _ in 0..12 {
                        std::thread::sleep(Duration::from_secs(1));
                        if crate::media::control(&app, MediaAction::Play) {
                            break;
                        }
                    }
                });
        }
    }
}

/// Window work belongs to the main thread.
pub(super) fn on_main<R: Runtime>(
    app: &AppHandle<R>,
    job: impl FnOnce(&AppHandle<R>) + Send + 'static,
) {
    let handle = app.clone();
    if let Err(e) = app.run_on_main_thread(move || job(&handle)) {
        tracing::warn!(error = %e, "voice: could not reach the main thread");
    }
}

/// The apps, the scenes and the user's music (its address as id), by name.
pub(super) fn lists(config: &ConfigState) -> (Vec<Named>, Vec<Named>, Vec<Named>) {
    let named = |id: &str, name: &str| Named {
        id: id.to_string(),
        name: name.to_string(),
    };
    let apps = config
        .apps()
        .apps
        .iter()
        .map(|a| named(&a.id, &a.name))
        .collect();
    let scenes = config
        .scenes()
        .iter()
        .map(|s| named(&s.id, &s.name))
        .collect();
    let links = config
        .settings()
        .voice
        .links
        .iter()
        .map(|l| named(&l.uri, &l.name))
        .collect();
    (apps, scenes, links)
}

pub(super) fn lists_of<R: Runtime>(app: &AppHandle<R>) -> (Vec<Named>, Vec<Named>, Vec<Named>) {
    lists(&app.state::<ConfigState>())
}

/// The apps as the brain is told them (brain/apps.rs).
pub(super) fn spoken_of<R: Runtime>(app: &AppHandle<R>) -> super::brain::apps::Spoken {
    super::brain::apps::of_config(&app.state::<ConfigState>().apps().apps)
}

/// The app's processes, else a sibling's (the same app found twice: the brain knows one of them,
/// brain/apps.rs), so that « ferme Voicemeeter » closes the copy that runs.
pub(super) fn pids_any<R: Runtime>(app: &AppHandle<R>, id: &str) -> Vec<u32> {
    let watch = app.state::<ProcWatch>();
    spoken_of(app)
        .members(id)
        .iter()
        .map(|m| watch.pids_of(m))
        .find(|p| !p.is_empty())
        .unwrap_or_default()
}

/// The themes installed, by name (« mets le thème Encre »).
pub(super) fn themes_of<R: Runtime>(app: &AppHandle<R>) -> Vec<Named> {
    app.state::<ConfigState>()
        .themes()
        .iter()
        .map(|t| Named {
            id: t.id.clone(),
            name: t.name.clone(),
        })
        .collect()
}

/// What the command model leans toward now: the wake word, the apps and scenes, the user's
/// music, the commands.
pub fn hotwords<R: Runtime>(app: &AppHandle<R>, wake_word: &str) -> String {
    let (apps, scenes, links) = lists(&app.state::<ConfigState>());
    command::hotwords(wake_word, &apps, &scenes, &links)
}

/// The user's music, opened in Spotify (an album or a track starts playing; a playlist opens:
/// Spotify plays it from outside only on a click). Only an address Réglages checked.
fn open_music(uri: &str) -> bool {
    if !crate::config::voice::spotify_uri_ok(uri) {
        return false;
    }
    let play = uri.starts_with("spotify:album:") || uri.starts_with("spotify:track:");
    let target = if play {
        format!("{uri}:play")
    } else {
        uri.to_string()
    };
    crate::platform::shell::shell_execute(&target, &[], None, None).is_ok()
}

/// `heard`: the whole sentence (shown to the user); `said`: its command part.
pub fn command<R: Runtime>(app: &AppHandle<R>, heard: &str, said: &str) {
    let config = app.state::<ConfigState>();
    let (apps, scenes, links) = lists(&config);
    let parsed = command::parse_with(said, &apps, &scenes, &links, &memory::recall);
    let taught = parsed.said;
    // Several sound alike: the one the user launches by far the most at this time of day.
    let intent = match parsed.intent {
        Intent::Doubt(targets) => match memory::prefer(&taught, &targets) {
            Some(t) => {
                tracing::info!("voice: a doubt settled by habit");
                Intent::Launch(t)
            }
            None => Intent::Doubt(targets),
        },
        other => other,
    };
    tracing::info!(intent = ?intent, "voice: a command");
    if matches!(intent, Intent::Doubt(_) | Intent::NotUnderstood) {
        // If the next sentence, soon, launches something, this one meant it too.
        memory::led_nowhere(&taught);
    }
    let outcome = perform(app, intent, &taught);
    tell(app, heard, outcome, Vec::new());
}

/// Several things asked at once (the brain, brain/prompt.rs): each done in turn, one note for
/// all; an app asked « sur mon premier écran » goes there once its window is up.
pub fn run<R: Runtime>(app: &AppHandle<R>, actions: Vec<super::brain::prompt::Action>) {
    let mut outcomes = Vec::new();
    for a in actions {
        tracing::info!(intent = ?a.intent, screen = ?a.screen, "voice: a command (brain)");
        let screen_for = match (&a.intent, a.screen) {
            (Intent::Launch(Target::App(id)), Some(n)) => Some((id.clone(), n)),
            _ => None,
        };
        let outcome = perform(app, a.intent, "");
        if let Some((id, n)) = screen_for {
            if matches!(outcome, VoiceOutcome::Launched { .. }) {
                on_screen(app, id, n);
            }
        }
        outcomes.push(outcome);
    }
    let mut rest = outcomes.into_iter();
    if let Some(first) = rest.next() {
        tell(app, "", first, rest.collect());
    }
}

/// The app's window, once it is up (20 s at most), put on screen `n`.
pub(super) fn on_screen<R: Runtime>(app: &AppHandle<R>, id: String, n: u32) {
    let app = app.clone();
    let _ = std::thread::Builder::new()
        .name("voice-screen".into())
        .spawn(move || {
            for _ in 0..40 {
                let pids = app.state::<ProcWatch>().pids_of(&id);
                if !pids.is_empty() && crate::platform::screens::move_to(&pids, n) {
                    tracing::info!(screen = n, "voice: a window put on its screen");
                    return;
                }
                std::thread::sleep(Duration::from_millis(500));
            }
            tracing::info!(screen = n, "voice: no window to put on its screen");
        });
}

/// What one intent does (`taught`: the words that named its target, for the memory).
fn perform<R: Runtime>(app: &AppHandle<R>, intent: Intent, taught: &str) -> VoiceOutcome {
    let config = app.state::<ConfigState>();
    let (apps, scenes, links) = lists(&config);
    match intent {
        Intent::Launch(Target::App(id)) => {
            let name = name_of(&apps, &id);
            let entry = config.apps().apps.into_iter().find(|a| a.id == id);
            let watch = app.state::<ProcWatch>();
            match entry.map(|e| launch_app(&SystemLauncher, &*watch, &e)) {
                Some(Ok(_)) => {
                    crate::ipc_desktop::note_recent(app, &config, &id);
                    memory::launched(taught, Target::App(id.clone()));
                    VoiceOutcome::Launched { id, name }
                }
                _ => VoiceOutcome::LaunchFailed { id, name },
            }
        }
        Intent::Launch(Target::Scene(id)) => {
            let name = name_of(&scenes, &id);
            let scene = id.clone();
            on_main(app, move |app| crate::desktop::trigger_scene(app, &scene));
            memory::launched(taught, Target::Scene(id.clone()));
            VoiceOutcome::SceneStarted { id, name }
        }
        Intent::Close(id) => {
            let name = name_of(&apps, &id);
            memory::closed(&id);
            let watch = app.state::<ProcWatch>();
            let pids = pids_any(app, &id);
            if !pids.is_empty() && watch.close_softly(&pids) {
                VoiceOutcome::Closed { id, name }
            } else {
                VoiceOutcome::NotRunning { id, name }
            }
        }
        Intent::Music(m) => {
            music(app, m);
            VoiceOutcome::Music { action: m }
        }
        Intent::Link(uri) => {
            let name = name_of(&links, &uri);
            if open_music(&uri) {
                VoiceOutcome::MusicOpened { name }
            } else {
                VoiceOutcome::NotUnderstood
            }
        }
        Intent::MusicMode(on) => {
            let patch = SettingsPatch {
                island_music: Some(on),
                ..Default::default()
            };
            if let Err(e) = crate::ipc::update_settings(app, patch) {
                tracing::warn!(error = %e.message, "voice: music mode not changed");
            }
            VoiceOutcome::MusicMode { on }
        }
        Intent::ShowKayro => {
            on_main(app, |app| crate::desktop::show(app));
            VoiceOutcome::ShowKayro
        }
        Intent::HideKayro => {
            on_main(app, |app| crate::desktop::hide(app));
            VoiceOutcome::HideKayro
        }
        Intent::Search(query) => {
            on_main(app, |app| crate::desktop::summon_search(app));
            VoiceOutcome::Search { query }
        }
        Intent::StopListening => {
            super::set_muted(app, true);
            VoiceOutcome::StoppedListening
        }
        Intent::Doubt(targets) => VoiceOutcome::Doubt {
            said: taught.to_string(),
            candidates: targets
                .into_iter()
                .map(|t| match t {
                    Target::App(id) => VoiceCandidate {
                        name: name_of(&apps, &id),
                        id,
                        scene: false,
                    },
                    Target::Scene(id) => VoiceCandidate {
                        name: name_of(&scenes, &id),
                        id,
                        scene: true,
                    },
                })
                .collect(),
        },
        Intent::NotUnderstood => VoiceOutcome::NotUnderstood,
        other => extra::perform(app, other),
    }
}

/// The page is told (a note); a doubt proposes: Kayro comes to ask.
pub(super) fn tell<R: Runtime>(
    app: &AppHandle<R>,
    heard: &str,
    outcome: VoiceOutcome,
    also: Vec<VoiceOutcome>,
) {
    let text = heard.trim().to_string();
    let heard = VoiceHeard {
        text,
        outcome,
        also,
    };
    // A doubt proposes, a timer ends, a page of Réglages opens: Kayro comes (a page still
    // loading takes it later).
    if matches!(
        heard.outcome,
        VoiceOutcome::Doubt { .. } | VoiceOutcome::TimerDone { .. } | VoiceOutcome::Settings { .. }
    ) {
        super::hold(&heard);
        on_main(app, |app| crate::desktop::show(app));
    }
    crate::ipc::notify(heard.emit(app));
}
