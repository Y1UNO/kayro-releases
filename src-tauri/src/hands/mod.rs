//! Step 22, the hands (docs/ROADMAP.md › Mains): a mouse in the air, all on the PC. The webcam
//! (Media Foundation, cam.rs) shows the hand to MediaPipe Hands in ONNX (track.rs); pointer.rs
//! turns its 21 points into the cursor: thumb and index apart, the cursor follows the hand;
//! thumb and index pinched, the left button (held: a drag); thumb and ring finger pinched, the
//! right button; a thumb up held a second turns the hands off. glide.rs moves the cursor
//! smoothly between two frames. Nothing seen is kept or sent.
//!
//! One thread (run.rs), started the first time the hands are turned on. The camera opens only
//! while they are on (Ctrl+Alt+M, Réglages): never at start-up, closed again by the same
//! shortcut, after a few minutes without a hand, while the screen is locked or — unless the user
//! wants it — a program in full screen (a game) is in front. The webcam's light and the glow
//! under the cursor show it.

mod cam;
mod glide;
mod glow;
pub mod models;
pub mod pointer;
mod run;
mod track;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Condvar, LazyLock, Mutex, MutexGuard};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime};
use tauri_specta::Event;

use crate::config::schema::{HandsSettings, Settings};
use crate::config::ConfigState;
use crate::platform::mic::{self, Front};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum HandsStatus {
    /// The camera is closed (the default).
    Off,
    /// On, the camera opening and the models loading.
    Starting,
    /// On, the camera open, no hand in front of it.
    Watching,
    /// A hand leads the cursor.
    Leading,
    /// On, but a game is in front or the screen is locked: the camera is closed until it ends.
    Paused,
    /// On, but the models are not installed.
    Missing,
    /// On, but no webcam answered.
    NoCamera,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HandsState {
    pub status: HandsStatus,
    /// Turned on by the user (the shortcut, Réglages); the status says what the camera does.
    pub on: bool,
}

/// Emitted whenever the hands' state changes.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct HandsStateChanged(pub HandsState);

/// What the thread follows; `gen` changes with any of it.
struct Shared {
    hands: HandsSettings,
    front: Front,
    on: bool,
    gen: u64,
    state: HandsState,
}

static SHARED: LazyLock<(Mutex<Shared>, Condvar)> = LazyLock::new(|| {
    let shared = Shared {
        hands: HandsSettings::default(),
        front: Front::default(),
        on: false,
        gen: 0,
        state: HandsState {
            status: HandsStatus::Off,
            on: false,
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
        s.on
    };
    SHARED.1.notify_all();
    if on && !STARTED.swap(true, Ordering::SeqCst) {
        let app = app.clone();
        let spawned = std::thread::Builder::new()
            .name("hands".into())
            .spawn(move || run::run(&app));
        if spawned.is_err() {
            STARTED.store(false, Ordering::SeqCst);
            tracing::warn!("hands: the thread could not start");
        }
    }
}

/// The thread's view: what to do now, and the generation it belongs to.
struct Now {
    hands: HandsSettings,
    on: bool,
    paused: bool,
    gen: u64,
}

fn now() -> Now {
    let s = lock();
    Now {
        hands: s.hands.clone(),
        on: s.on,
        paused: s.front.locked || (s.front.full_screen && !s.hands.in_game),
        gen: s.gen,
    }
}

fn changed(gen: u64) -> bool {
    lock().gen != gen
}

/// Parks the thread until something changes (no camera, no loop).
fn wait_change(gen: u64) {
    let mut s = lock();
    while s.gen == gen {
        s = SHARED.1.wait(s).unwrap_or_else(|p| p.into_inner());
    }
}

/// Parks the thread until something changes or `at_most` has passed (a webcam to look for again).
fn wait_change_for(gen: u64, at_most: Duration) {
    let s = lock();
    if s.gen == gen {
        let _ = SHARED.1.wait_timeout_while(s, at_most, |s| s.gen == gen);
    }
}

fn set_status<R: Runtime>(app: &AppHandle<R>, status: HandsStatus) {
    let (fresh, state) = {
        let mut s = lock();
        let state = HandsState { status, on: s.on };
        let fresh = s.state != state;
        s.state = state.clone();
        (fresh, state)
    };
    if fresh {
        tracing::info!(status = ?state.status, on = state.on, "hands: state");
        crate::ipc::notify(HandsStateChanged(state).emit(app));
    }
}

pub fn state() -> HandsState {
    lock().state.clone()
}

/// Turns the camera on or off (the shortcut, Réglages). Refused (stays off) while the hands are
/// not set up.
pub fn set_on<R: Runtime>(app: &AppHandle<R>, on: bool) {
    let on = on && lock().hands.enabled;
    if lock().on == on {
        return;
    }
    update(app, |s| s.on = on);
    if !on {
        set_status(app, HandsStatus::Off);
    }
}

/// The shortcut: on ↔ off.
pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    let on = lock().on;
    set_on(app, !on);
}

/// The models were downloaded or removed: the thread looks again.
pub fn models_changed<R: Runtime>(app: &AppHandle<R>) {
    update(app, |_| {});
}

/// At start-up: the saved settings, what is in front, the shortcut. The camera stays closed.
pub fn init<R: Runtime>(app: &AppHandle<R>) {
    let hands = app.state::<ConfigState>().settings().hands;
    register_shortcut(app, &hands);
    let front = mic::front(std::process::id());
    update(app, |s| {
        s.hands = hands;
        s.front = front;
    });
}

/// The shortcut is registered only once the hands are set up.
fn register_shortcut<R: Runtime>(app: &AppHandle<R>, hands: &HandsSettings) {
    let hotkey = if hands.enabled {
        hands.hotkey.as_str()
    } else {
        ""
    };
    if let Err(problem) = crate::desktop::hotkeys::set_hands(app, hotkey) {
        tracing::info!(hotkey, ?problem, "hands: shortcut not registered");
    }
}

pub fn settings_changed<R: Runtime>(app: &AppHandle<R>, old: &Settings, new: &Settings) {
    if old.hands == new.hands {
        return;
    }
    register_shortcut(app, &new.hands);
    let hands = new.hands.clone();
    let off = !hands.enabled;
    update(app, |s| {
        s.hands = hands;
        if off {
            s.on = false;
        }
    });
    if off {
        set_status(app, HandsStatus::Off);
    }
}

/// From the foreground hook: a game in full screen, or the locked screen.
pub fn on_foreground<R: Runtime>(app: &AppHandle<R>) {
    let front = mic::front(std::process::id());
    if lock().front != front {
        update(app, |s| s.front = front);
    }
}

/// No hand for too long, or a thumb up held: the camera turns itself off (unless something else
/// changed meanwhile).
fn turn_off<R: Runtime>(app: &AppHandle<R>, gen: u64) {
    let fresh = {
        let s = lock();
        s.gen == gen && s.on
    };
    if fresh {
        tracing::info!("hands: turned off from the camera (thumb up, or no hand)");
        set_on(app, false);
    }
}
