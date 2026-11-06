//! Step 21, the voice (docs/ROADMAP.md › Voix): Kayro started by a sentence, all on the PC.
//! Two modes (Réglages): push-to-talk (the microphone opens while the shortcut is held) or always
//! listening (speech detection, then the sentence cut out by the ear, phrase.rs). With the brain
//! (brain/), the sentence itself is heard on the graphics card: whether it was said to the
//! assistant and what it asks, several things at once; without it, the classic way: the wake word
//! in what the small French model hears, the command written down by Parakeet or Canary and read
//! by the rules (command.rs). Either way a sentence only ever starts Kayro's own apps, scenes and
//! actions (act.rs). Nothing heard is kept or sent, but the calibration's sayings, on the user's
//! demand (calib.rs).
//!
//! One thread (listen.rs), started the first time the voice is turned on: it opens the
//! microphone only to listen, and parks (no microphone, no loop) while the voice is off, muted,
//! the screen locked, or — in the « always » mode, unless the user wants it — a program in full
//! screen is in front. Its models stay loaded until the voice is turned off (the brain lets the
//! card go while a game fills the screen).

mod act;
pub mod brain;
pub mod calib;
pub mod command;
mod ear;
pub mod echo;
mod events;
pub use command::Music;
pub use events::{
    VoiceCandidate, VoiceHeard, VoiceLearned, VoiceOutcome, VoiceState, VoiceStateChanged,
    VoiceStatus,
};
pub mod engine;
mod follow;
mod listen;
pub mod memory;
pub mod models;
mod phrase;
pub mod speaker;
mod think;
pub mod wake;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Condvar, LazyLock, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, Runtime};
use tauri_specta::Event;

use crate::config::schema::{Settings, VoiceMode, VoiceSettings};
use crate::config::ConfigState;
use crate::platform::mic::{self, Front};

static LEARNING: AtomicBool = AtomicBool::new(false);

/// The guided learning starts (each sentence heard is an example, no command runs) or ends.
pub fn set_learning(on: bool) {
    LEARNING.store(on, Ordering::SeqCst);
}

fn learning() -> bool {
    LEARNING.load(Ordering::SeqCst)
}

fn learned<R: Runtime>(app: &AppHandle<R>, text: &str) {
    let heard = command::wake_part(text);
    if !heard.is_empty() {
        crate::ipc::notify(VoiceLearned { heard }.emit(app));
    }
}

/// What the listening thread follows; `gen` changes with any of it.
struct Shared {
    voice: VoiceSettings,
    front: Front,
    muted: bool,
    talk: bool,
    gen: u64,
    state: VoiceState,
}

static SHARED: LazyLock<(Mutex<Shared>, Condvar)> = LazyLock::new(|| {
    let shared = Shared {
        voice: VoiceSettings::default(),
        front: Front::default(),
        muted: false,
        talk: false,
        gen: 0,
        state: VoiceState {
            status: VoiceStatus::Off,
            missing: None,
        },
    };
    (Mutex::new(shared), Condvar::new())
});
static STARTED: AtomicBool = AtomicBool::new(false);

fn lock() -> MutexGuard<'static, Shared> {
    SHARED.0.lock().unwrap_or_else(|p| p.into_inner())
}

/// Changes what the thread follows, wakes it, and starts it the first time it has work.
fn update<R: Runtime>(app: &AppHandle<R>, change: impl FnOnce(&mut Shared)) {
    let on = {
        let mut s = lock();
        change(&mut s);
        s.gen += 1;
        s.voice.mode != VoiceMode::Off || calib::active()
    };
    SHARED.1.notify_all();
    if on && !STARTED.swap(true, Ordering::SeqCst) {
        let app = app.clone();
        let spawned = std::thread::Builder::new()
            .name("voice".into())
            .spawn(move || listen::run(&app));
        if spawned.is_err() {
            STARTED.store(false, Ordering::SeqCst);
            tracing::warn!("voice: the listening thread could not start");
        }
    }
}

/// The thread's view: what to do now, and the generation it belongs to.
struct Now {
    voice: VoiceSettings,
    paused: bool,
    muted: bool,
    /// A program in full screen is in front (the brain gives the card's memory back).
    gaming: bool,
    gen: u64,
}

/// While calibrating (« Calibrer ma voix »), the voice listens as in the always mode whatever its
/// mode, muted or not (the user is in front of Réglages: no game).
fn now() -> Now {
    let s = lock();
    let calibrating = calib::active();
    let in_game = s.front.full_screen && !s.voice.in_game && s.voice.mode == VoiceMode::Always;
    let mut voice = s.voice.clone();
    if calibrating {
        voice.mode = VoiceMode::Always;
    }
    Now {
        voice,
        paused: s.front.locked || (in_game && !calibrating),
        muted: s.muted && !calibrating,
        gaming: s.front.full_screen && !calibrating,
        gen: s.gen,
    }
}

fn changed(gen: u64) -> bool {
    lock().gen != gen
}

/// Parks the thread until something changes (no loop, no microphone).
fn wait_change(gen: u64) {
    let mut s = lock();
    while s.gen == gen {
        s = SHARED.1.wait(s).unwrap_or_else(|p| p.into_inner());
    }
}

/// Parks the thread until something changes, or `at_most` has passed (a microphone to look for
/// again).
fn wait_change_for(gen: u64, at_most: Duration) {
    let until = Instant::now() + at_most;
    let mut s = lock();
    while s.gen == gen {
        let left = until.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return;
        }
        s = SHARED
            .1
            .wait_timeout(s, left)
            .unwrap_or_else(|p| p.into_inner())
            .0;
    }
}

/// Push-to-talk: parks until the shortcut is held (`true`) or something changes (`false`).
fn wait_talk(gen: u64) -> bool {
    let mut s = lock();
    loop {
        if s.gen != gen {
            return false;
        }
        if s.talk {
            return true;
        }
        s = SHARED.1.wait(s).unwrap_or_else(|p| p.into_inner());
    }
}

fn talking() -> bool {
    lock().talk
}

fn set_state<R: Runtime>(app: &AppHandle<R>, status: VoiceStatus, missing: Option<String>) {
    let state = VoiceState { status, missing };
    let fresh = {
        let mut s = lock();
        let fresh = s.state != state;
        s.state = state.clone();
        fresh
    };
    if fresh {
        // Where the voice stands, never what was said (to understand a « nothing happens »).
        tracing::info!(status = ?state.status, missing = ?state.missing, "voice: state");
        crate::ipc::notify(VoiceStateChanged(state).emit(app));
    }
}

pub fn state() -> VoiceState {
    lock().state.clone()
}

/// A model was downloaded or removed, or the calibration started, ended or wants an
/// evaluation: the thread looks again at what to do.
pub fn models_changed<R: Runtime>(app: &AppHandle<R>) {
    update(app, |_| {});
}

/// Is the model `id` needed by the voice as it is set now (it cannot be removed then)?
pub fn in_use(id: &str, voice: &VoiceSettings) -> bool {
    let command = match voice.model {
        crate::config::schema::VoiceModel::Parakeet => "parakeet",
        crate::config::schema::VoiceModel::Canary => "canary",
    };
    match voice.mode {
        VoiceMode::Off => false,
        VoiceMode::PushToTalk => id == command,
        VoiceMode::Always => id == command || id == "silero" || id == "wake",
    }
}

/// At start-up: the saved settings, what is in front, the push-to-talk shortcut.
pub fn init<R: Runtime>(app: &AppHandle<R>) {
    let voice = app.state::<ConfigState>().settings().voice;
    register_shortcut(app, &voice);
    let front = mic::front(std::process::id());
    update(app, |s| {
        s.voice = voice;
        s.front = front;
    });
}

/// The push-to-talk shortcut is registered only in that mode.
fn register_shortcut<R: Runtime>(app: &AppHandle<R>, voice: &VoiceSettings) {
    let hotkey = if voice.mode == VoiceMode::PushToTalk {
        voice.hotkey.as_str()
    } else {
        ""
    };
    if let Err(problem) = crate::desktop::hotkeys::set_voice(app, hotkey) {
        tracing::info!(
            hotkey,
            ?problem,
            "voice: push-to-talk shortcut not registered"
        );
    }
}

pub fn settings_changed<R: Runtime>(app: &AppHandle<R>, old: &Settings, new: &Settings) {
    if old.voice == new.voice {
        return;
    }
    register_shortcut(app, &new.voice);
    let voice = new.voice.clone();
    let mode_changed = old.voice.mode != new.voice.mode;
    update(app, |s| {
        s.voice = voice;
        if mode_changed {
            s.muted = false;
        }
    });
}

/// From the foreground hook: a game in full screen, or the locked screen.
pub fn on_foreground<R: Runtime>(app: &AppHandle<R>) {
    let front = mic::front(std::process::id());
    if lock().front != front {
        update(app, |s| s.front = front);
    }
}

/// The push-to-talk shortcut pressed (`true`) or released: not a change of what to do (`gen`
/// stays), the thread just records while it is held.
pub fn talk(down: bool) {
    lock().talk = down;
    SHARED.1.notify_all();
}

/// « Arrête d'écouter », or the microphone button: closed until it is pressed again (or the
/// mode changes).
pub fn set_muted<R: Runtime>(app: &AppHandle<R>, muted: bool) {
    if lock().muted != muted {
        update(app, |s| s.muted = muted);
    }
}

/// A command that waits for the user (« ferme X », or a doubt): Kayro is shown, and a page that
/// was still loading takes it here.
static PENDING: Mutex<Option<VoiceHeard>> = Mutex::new(None);

fn hold(heard: &VoiceHeard) {
    *PENDING.lock().unwrap_or_else(|p| p.into_inner()) = Some(heard.clone());
}

pub fn take_pending() -> Option<VoiceHeard> {
    PENDING.lock().unwrap_or_else(|p| p.into_inner()).take()
}
