//! The hub's presence on the desktop: display modes, showing and hiding, the global shortcuts
//! and the notification-area menu (ARCHITECTURE.md §4, PLAN.md §3 spikes a/b/04/05).
//!
//! Kayro's window (`main`, immersive or normal) and the island (Kysland, `widget`): the island is
//! on screen whenever Kayro is not (`island::sync`). « Instantané » keeps `main` loaded while
//! hidden; « Mode économe » destroys it and builds it again on demand. On screen, a mode change is
//! a passage (round 4b: the page fades out, the window changes, the page comes back, `passage`).

pub mod cover;
mod express;
pub mod geometry;
pub mod hotkeys;
pub mod island;
mod modes;
pub mod passage;
mod placement;
mod quit;
mod shortcuts;
pub mod tray;
mod wake;
mod windows;

pub use modes::settings_changed;
use placement::save_placement;
pub use express::intro_done;
pub use placement::{choose_immersive_screen, screen_names};
pub use quit::{on_exit, quit};
pub use shortcuts::{on_hotkey, scenes_changed, take_pending_scene, trigger_scene};

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime, WebviewWindow, WindowEvent};
use tauri_specta::Event;

use crate::config::schema::{DisplayMode, OpeningScreen, Settings, StartupOpen};
use crate::config::ConfigState;
use crate::error::AppError;

use windows::{MAIN, WIDGET};

/// Losing the focus right after a show is not the user clicking away (Windows may still be
/// settling who is in front).
const BLUR_GRACE: Duration = Duration::from_millis(300);

/// The hub appeared (or went away). `bench` asks the page to report when it painted.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct WindowVisibility {
    pub visible: bool,
    pub bench: bool,
}

/// A scene shortcut was pressed for a scene that must be confirmed (it closes apps): the
/// interface shows the confirmation. Also kept for a page that is not loaded yet
/// (`scene_hotkey_take`).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct SceneHotkey(pub String);

#[derive(Default)]
pub struct DesktopState {
    /// A window is being prepared and must be shown as soon as its page has painted.
    want_visible: AtomicBool,
    shown_at: Mutex<Option<Instant>>,
    pending_scene: Mutex<Option<String>>,
    pressed_at: Mutex<Option<Instant>>,
    /// When the window being built was asked for (logged when its page is ready).
    building_since: Mutex<Option<Instant>>,
    /// The passage between modes whose fade-out is awaited (round 4b).
    passage: passage::Waiting,
    /// Step 19: the express start shows `main` in immersive mode whatever the setting, until the
    /// hub is first hidden (or the mode is changed): it then goes back to the user's mode.
    express_immersive: AtomicBool,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|p| p.into_inner())
}

/// Set `KAYRO_BENCH_SHOW` to a file path to log « shortcut → painted » times (scripts/measure-show.ps1).
fn bench_file() -> Option<std::path::PathBuf> {
    std::env::var_os("KAYRO_BENCH_SHOW").map(Into::into)
}

fn settings<R: Runtime>(app: &AppHandle<R>) -> Settings {
    app.state::<ConfigState>().settings()
}

// ───────────────────────────── start-up and windows ─────────────────────────────

/// Called once from `setup`, after the notification-area icon exists. A silent start (Windows
/// login) follows « Au démarrage » (2026-10-31): the intro (the still logo, always immersive),
/// the hub in immersive mode (its usual opening), the island (Kysland), or nothing on screen.
/// The last two build Kayro's window hidden (nothing in economy mode) and play no opening.
pub fn startup<R: Runtime>(app: &AppHandle<R>, silent: bool) {
    hotkeys::init(app);
    let s = settings(app);
    if silent {
        match s.startup_open {
            StartupOpen::Intro => return express::start(app, &s, true),
            StartupOpen::Immersive => return express::start(app, &s, false),
            StartupOpen::Island => {}
            StartupOpen::Hidden => island::quiet(),
        }
        crate::ipc_desktop::OPENING.silent_start();
        if s.economy_mode {
            tracing::info!("silent start, economy mode: no window yet");
        } else if let Err(e) = create_for(app, s.display_mode, false) {
            tracing::error!(error = %e, "could not create the window");
        }
        return island::sync(app);
    }
    app.state::<DesktopState>()
        .want_visible
        .store(true, Ordering::SeqCst);
    if let Err(e) = create_for(app, s.display_mode, false) {
        tracing::error!(error = %e, "could not create the window");
    }
}

/// Builds the hidden window of `mode`, wired to the window events. `entering`: built for a
/// passage between modes, its page fades in on its first show.
fn create_for<R: Runtime>(
    app: &AppHandle<R>,
    mode: DisplayMode,
    entering: bool,
) -> Result<WebviewWindow<R>, AppError> {
    let screens = windows::screens(app);
    if screens.is_empty() {
        return Err(AppError::not_found("a screen"));
    }
    let ui = app.state::<ConfigState>().ui_state();
    // A passage between modes keeps its screen; an opening follows « Écran d'ouverture ».
    let choice = if entering {
        OpeningScreen::Last
    } else {
        settings(app).opening_screen
    };
    let window = match mode {
        DisplayMode::Immersive => {
            let i = windows::opening_screen(app, &screens, &ui.immersive, None, choice);
            windows::create_main(app, mode, &screens[i], &ui.window, entering)?
        }
        DisplayMode::Window => {
            let i = windows::opening_screen(app, &screens, &ui.window, None, choice);
            windows::create_main(app, mode, &screens[i], &ui.window, entering)?
        }
    };
    attach_events(app, &window);
    Ok(window)
}

fn attach_events<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let app = app.clone();
    let label = window.label().to_string();
    window.on_window_event(move |event| match event {
        // The croix only hides: the hub lives in the notification area, « Quitter » ends it.
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            hide(&app);
        }
        WindowEvent::Focused(focused) => on_focus(&app, &label, *focused),
        WindowEvent::ThemeChanged(_) | WindowEvent::ScaleFactorChanged { .. } => {
            tray::refresh_icon(&app);
        }
        _ => {}
    });
}

fn on_focus<R: Runtime>(app: &AppHandle<R>, label: &str, focused: bool) {
    if label != MAIN {
        return; // the widget never hides by itself: its page folds the panel
    }
    let s = settings(app);
    let express = app.state::<DesktopState>().in_express_immersive();
    if let Some(window) = windows::get(app, label) {
        // Covers the taskbar only while the hub is the program in front (spike 04).
        // 30/10: a launch cover keeps it in front while the game starts behind it (cover.rs).
        if s.display_mode == DisplayMode::Immersive || express || cover::covering() {
            let _ = window.set_always_on_top(focused || cover::covering());
        }
    }
    let settled =
        lock(&app.state::<DesktopState>().shown_at).is_none_or(|t| t.elapsed() > BLUR_GRACE);
    if !focused && s.hide_on_blur && settled {
        hide(app);
    }
}

// ───────────────────────────── showing and hiding ─────────────────────────────

/// Puts Kayro's window on screen and in front; the island and the wake cover go.
fn reveal<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let state = app.state::<DesktopState>();
    state.want_visible.store(false, Ordering::SeqCst);
    *lock(&state.shown_at) = Some(Instant::now());
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    finish_show(window);
    wake::lift(app);
    island::sync(app);
    crate::ipc::notify(
        WindowVisibility {
            visible: true,
            bench: lock(&state.pressed_at).is_some(),
        }
        .emit_to(app, MAIN),
    );
}

/// Runs behind the `show` in the toolkit's queue: the focus is taken for real when Windows
/// refused the first request.
fn finish_show<R: Runtime>(window: &WebviewWindow<R>) {
    let Ok(hwnd) = window.hwnd() else { return };
    let raw = hwnd.0 as isize;
    if let Err(e) = window.run_on_main_thread(move || {
        crate::platform::own_window::force_foreground(raw);
    }) {
        tracing::warn!(error = %e, "could not finish showing the window");
    }
}

/// Shows the hub in the current mode (building its window when there is none).
pub fn show<R: Runtime>(app: &AppHandle<R>) {
    let express = app.state::<DesktopState>().in_express_immersive();
    if let Some(window) = windows::get(app, MAIN).filter(|_| express) {
        return reveal(app, &window); // still the express start's immersive window
    }
    let mode = settings(app).display_mode;
    match windows::get(app, MAIN) {
        Some(window) => {
            if mode == DisplayMode::Immersive {
                refit_immersive(app, &window);
            } else if mode == DisplayMode::Window && windows::visible(app).is_none() {
                follow_opening_screen(app, &window);
            }
            reveal(app, &window);
        }
        None => {
            let state = app.state::<DesktopState>();
            state.want_visible.store(true, Ordering::SeqCst);
            *lock(&state.building_since) = Some(Instant::now());
            if let Err(e) = create_for(app, mode, false) {
                tracing::error!(error = %e, "could not create the window");
            } else if let Some(t0) = *lock(&state.building_since) {
                tracing::info!(ms = t0.elapsed().as_millis() as u64, "window built");
            }
        }
    }
}

/// The screen may have changed (resolution, unplugged cable) while the window was hidden.
fn refit_immersive<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let screens = windows::screens(app);
    if screens.is_empty() {
        return;
    }
    let ui = app.state::<ConfigState>().ui_state();
    let choice = settings(app).opening_screen;
    let i = windows::opening_screen(app, &screens, &ui.immersive, Some(window), choice);
    windows::configure_main(window, DisplayMode::Immersive, &screens[i], &ui.window);
}

/// Normal window reopened: moved to the screen « Écran d'ouverture » asks for (same place on it),
/// left alone when it is already there or when the choice is « dernier utilisé ».
fn follow_opening_screen<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let choice = settings(app).opening_screen;
    if choice == OpeningScreen::Last {
        return;
    }
    let screens = windows::screens(app);
    if screens.is_empty() {
        return;
    }
    let ui = app.state::<ConfigState>().ui_state();
    let i = windows::opening_screen(app, &screens, &ui.window, Some(window), choice);
    if windows::screen_of(window, &screens) != Some(i) {
        windows::configure_main(window, DisplayMode::Window, &screens[i], &ui.window);
    }
}

/// Hides the hub (the island comes, see `island::sync`). In economy mode the window is destroyed.
pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<DesktopState>();
    state.want_visible.store(false, Ordering::SeqCst);
    let Some(window) = windows::visible(app) else {
        return island::sync(app);
    };
    let mode = settings(app).display_mode;
    let express = state.end_express_immersive();
    if !express {
        save_placement(app, &window, mode);
    }
    let _ = window.hide();
    crate::ipc::notify(
        WindowVisibility {
            visible: false,
            bench: false,
        }
        .emit_to(app, MAIN),
    );
    if settings(app).economy_mode {
        let _ = window.destroy();
    } else if express {
        express::leave(app, &window, mode);
    }
    island::sync(app);
}

/// Shortcut and notification-area behaviour: hide when in front, bring forward when hidden or
/// behind.
pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    match windows::visible(app) {
        Some(w) if w.is_focused().unwrap_or(false) => hide(app),
        Some(w) => {
            *lock(&app.state::<DesktopState>().shown_at) = Some(Instant::now());
            let _ = w.set_focus();
        }
        None => show(app),
    }
}

/// Called by the page after its first paint. True when the window was shown because of a
/// shortcut being measured: the page then reports its own paint (see `painted`).
pub fn page_ready<R: Runtime>(app: &AppHandle<R>, label: &str) -> bool {
    let state = app.state::<DesktopState>();
    if let Some(t0) = lock(&state.building_since).take() {
        let since_start = crate::STARTED.get().map(|s| s.elapsed().as_millis() as u64);
        tracing::info!(
            ms = t0.elapsed().as_millis() as u64,
            ?since_start,
            "page ready"
        );
    }
    if label == WIDGET {
        island::page_ready(app);
        return false;
    }
    if !state.want_visible.swap(false, Ordering::SeqCst) {
        return false;
    }
    if let Some(window) = windows::get(app, MAIN) {
        reveal(app, &window);
    }
    let measuring = lock(&state.pressed_at).is_some();
    measuring
}

/// Called by the page two frames after it was shown (only when a measurement is running).
pub fn painted<R: Runtime>(app: &AppHandle<R>) {
    let Some(t0) = lock(&app.state::<DesktopState>().pressed_at).take() else {
        return;
    };
    let ms = t0.elapsed().as_secs_f64() * 1000.0;
    tracing::info!(ms, "shortcut to painted");
    if let Some(path) = bench_file() {
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
        {
            let _ = writeln!(f, "{ms:.2}");
        }
    }
}
