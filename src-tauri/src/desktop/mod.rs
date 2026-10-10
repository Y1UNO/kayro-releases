//! The hub's presence on the desktop: display modes, showing and hiding, the global shortcuts
//! and the notification-area menu (ARCHITECTURE.md §4, PLAN.md §3 spikes a/b/04/05).
//!
//! One window exists at a time. « Instantané » keeps it loaded while hidden; « Mode économe »
//! destroys it and builds it again on demand. Changing to or from the widget builds the new
//! window first and retires the old one once the new one is painted, so nothing flickers.

pub mod geometry;
pub mod hotkeys;
mod placement;
mod shortcuts;
pub mod tray;
mod windows;

use placement::save_placement;
pub use placement::{choose_immersive_screen, fit_widget, screen_names};
pub use shortcuts::{on_hotkey, scenes_changed, take_pending_scene, trigger_scene};

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime, WebviewWindow, WindowEvent};
use tauri_specta::Event;

use crate::config::schema::{DisplayMode, Settings};
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
    /// Window to destroy once the new one is on screen (mode change involving the widget).
    retire: Mutex<Option<&'static str>>,
    shown_at: Mutex<Option<Instant>>,
    pending_scene: Mutex<Option<String>>,
    pressed_at: Mutex<Option<Instant>>,
    /// When the window being built was asked for (logged when its page is ready).
    building_since: Mutex<Option<Instant>>,
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
/// login) creates the window hidden, or nothing at all in economy mode.
pub fn startup<R: Runtime>(app: &AppHandle<R>, silent: bool) {
    hotkeys::init(app);
    let s = settings(app);
    if silent && s.economy_mode {
        tracing::info!("silent start, economy mode: no window yet");
        return;
    }
    app.state::<DesktopState>()
        .want_visible
        .store(!silent, Ordering::SeqCst);
    if let Err(e) = create_for(app, s.display_mode) {
        tracing::error!(error = %e, "could not create the window");
    }
}

/// Builds the hidden window of `mode`, wired to the window events.
fn create_for<R: Runtime>(
    app: &AppHandle<R>,
    mode: DisplayMode,
) -> Result<WebviewWindow<R>, AppError> {
    let screens = windows::screens(app);
    if screens.is_empty() {
        return Err(AppError::not_found("a screen"));
    }
    let ui = app.state::<ConfigState>().ui_state();
    let window = match mode {
        DisplayMode::Immersive => {
            let i = windows::choose_screen(app, &screens, &ui.immersive, None);
            windows::create_main(app, mode, &screens[i], &ui.window)?
        }
        DisplayMode::Window => {
            let i = windows::choose_screen(app, &screens, &ui.window, None);
            windows::create_main(app, mode, &screens[i], &ui.window)?
        }
        DisplayMode::Widget => {
            let i = windows::choose_screen(app, &screens, &ui.widget, None);
            windows::create_widget(app, &screens[i], &ui.widget)?
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
    if let Some(window) = windows::get(app, label) {
        // Covers the taskbar only while the hub is the program in front (spike 04).
        if s.display_mode == DisplayMode::Immersive {
            let _ = window.set_always_on_top(focused);
        }
    }
    let settled =
        lock(&app.state::<DesktopState>().shown_at).is_none_or(|t| t.elapsed() > BLUR_GRACE);
    if !focused && s.hide_on_blur && settled {
        hide(app);
    }
}

// ───────────────────────────── showing and hiding ─────────────────────────────

/// Puts a built window on screen and in front.
fn reveal<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let state = app.state::<DesktopState>();
    state.want_visible.store(false, Ordering::SeqCst);
    *lock(&state.shown_at) = Some(Instant::now());
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    finish_show(window);
    if let Some(label) = lock(&state.retire).take() {
        retire(app, label);
    }
    crate::ipc::notify(
        WindowVisibility {
            visible: true,
            bench: lock(&state.pressed_at).is_some(),
        }
        .emit(app),
    );
}

/// Runs behind the `show` in the toolkit's queue. The toolkit rewrites a window's extended
/// style on every show (it always adds « appears in the taskbar and Alt+Tab »), so the widget's
/// tool-window style is applied again here; and the focus is taken for real when Windows
/// refused the first request.
fn finish_show<R: Runtime>(window: &WebviewWindow<R>) {
    let Ok(hwnd) = window.hwnd() else { return };
    let (raw, widget) = (hwnd.0 as isize, window.label() == WIDGET);
    if let Err(e) = window.run_on_main_thread(move || {
        if widget {
            crate::platform::own_window::set_tool_window(raw);
        }
        crate::platform::own_window::force_foreground(raw);
    }) {
        tracing::warn!(error = %e, "could not finish showing the window");
    }
}

/// Destroys a window that a mode change replaced.
fn retire<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(old) = windows::get(app, label) {
        let mode = if label == WIDGET {
            DisplayMode::Widget
        } else {
            settings(app).display_mode
        };
        save_placement(app, &old, mode);
        let _ = old.destroy();
    }
}

/// Shows the hub in the current mode (building its window when there is none).
pub fn show<R: Runtime>(app: &AppHandle<R>) {
    let mode = settings(app).display_mode;
    match windows::get(app, windows::label_for(mode)) {
        Some(window) => {
            if mode == DisplayMode::Immersive {
                refit_immersive(app, &window);
            }
            reveal(app, &window);
        }
        None => {
            let state = app.state::<DesktopState>();
            state.want_visible.store(true, Ordering::SeqCst);
            *lock(&state.building_since) = Some(Instant::now());
            if let Err(e) = create_for(app, mode) {
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
    let i = windows::choose_screen(app, &screens, &ui.immersive, Some(window));
    windows::configure_main(window, DisplayMode::Immersive, &screens[i], &ui.window);
}

/// Hides the hub. In economy mode the window is destroyed.
pub fn hide<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<DesktopState>();
    state.want_visible.store(false, Ordering::SeqCst);
    let Some(window) = windows::visible(app) else {
        return;
    };
    let mode = if window.label() == WIDGET {
        DisplayMode::Widget
    } else {
        settings(app).display_mode
    };
    save_placement(app, &window, mode);
    let _ = window.hide();
    crate::ipc::notify(
        WindowVisibility {
            visible: false,
            bench: false,
        }
        .emit(app),
    );
    if settings(app).economy_mode {
        let _ = window.destroy();
    }
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

/// « Quitter »: remembers the placement, then ends the process.
pub fn quit<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = windows::visible(app) {
        let mode = if w.label() == WIDGET {
            DisplayMode::Widget
        } else {
            settings(app).display_mode
        };
        save_placement(app, &w, mode);
    }
    app.exit(0);
}

/// Called by the page after its first paint. True when the window was shown because of a
/// shortcut being measured: the page then reports its own paint (see `painted`).
pub fn page_ready<R: Runtime>(app: &AppHandle<R>, label: &str) -> bool {
    let state = app.state::<DesktopState>();
    if let Some(t0) = lock(&state.building_since).take() {
        tracing::info!(ms = t0.elapsed().as_millis() as u64, "page ready");
    }
    if !state.want_visible.swap(false, Ordering::SeqCst) {
        return false;
    }
    if let Some(window) = windows::get(app, label) {
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

// ───────────────────────────── settings that act on windows ─────────────────────────────

/// Applies what changed between two settings: the display mode, the economy mode, the menu.
pub fn settings_changed<R: Runtime>(app: &AppHandle<R>, old: &Settings, new: &Settings) {
    if old.display_mode != new.display_mode {
        mode_changed(app, old.display_mode, new.display_mode);
    }
    if old.economy_mode != new.economy_mode {
        economy_changed(app, new);
    }
    if old.display_mode != new.display_mode {
        tray::rebuild_menu(app);
    }
}

fn mode_changed<R: Runtime>(app: &AppHandle<R>, old: DisplayMode, new: DisplayMode) {
    let state = app.state::<DesktopState>();
    let old_label = windows::label_for(old);
    let old_window = windows::get(app, old_label);
    if let Some(w) = &old_window {
        save_placement(app, w, old);
    }
    if old_label == windows::label_for(new) {
        // Immersive ⇄ window: the same window, reconfigured.
        let Some(window) = old_window else { return };
        let screens = windows::screens(app);
        if screens.is_empty() {
            return;
        }
        let ui = app.state::<ConfigState>().ui_state();
        let saved = if new == DisplayMode::Immersive {
            &ui.immersive
        } else {
            &ui.window
        };
        let i = windows::choose_screen(app, &screens, saved, Some(&window));
        windows::configure_main(&window, new, &screens[i], &ui.window);
        if new == DisplayMode::Immersive && window.is_focused().unwrap_or(false) {
            let _ = window.set_always_on_top(true);
        }
        return;
    }
    // The widget is involved: another window.
    let shown = windows::visible(app).is_some();
    if shown {
        *lock(&state.retire) = Some(old_label);
        state.want_visible.store(true, Ordering::SeqCst);
        if let Err(e) = create_for(app, new) {
            tracing::error!(error = %e, "could not create the window");
            *lock(&state.retire) = None;
            state.want_visible.store(false, Ordering::SeqCst);
        }
    } else {
        if let Some(w) = old_window {
            let _ = w.destroy();
        }
        if !settings(app).economy_mode {
            if let Err(e) = create_for(app, new) {
                tracing::error!(error = %e, "could not create the window");
            }
        }
    }
}

fn economy_changed<R: Runtime>(app: &AppHandle<R>, now: &Settings) {
    let shown = windows::visible(app).is_some();
    if now.economy_mode && !shown {
        for label in [MAIN, WIDGET] {
            if let Some(w) = windows::get(app, label) {
                let _ = w.destroy();
            }
        }
    } else if !now.economy_mode && windows::get(app, windows::label_for(now.display_mode)).is_none()
    {
        if let Err(e) = create_for(app, now.display_mode) {
            tracing::error!(error = %e, "could not create the window");
        }
    }
}
