//! 2026-10-31, « île toujours là »: the island is Kayro's companion, no longer a display mode.
//! Whenever Kayro's window is not on screen, the island is (« Kysland toujours à l'écran »,
//! Réglages › Raccourcis clavier, on by default); Kayro on screen, the island goes. A program in
//! full screen in front of its screen hides it too, until that program leaves the front.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Runtime, WebviewWindow};
use tauri_specta::Event;

use super::super::windows::{self, WIDGET};
use super::{effects, stage, tuck, win, DUCKED};

/// « Au démarrage : Caché » (or « Après l'intro : Caché »): nothing on screen, the island
/// neither, until Kayro is first shown.
static QUIET: AtomicBool = AtomicBool::new(false);
/// The island's window is being built: it shows once its page has painted (`page_ready`).
static WANT: AtomicBool = AtomicBool::new(false);

/// Nothing on screen until Kayro is first shown.
pub fn quiet() {
    QUIET.store(true, Ordering::SeqCst);
}

fn wanted<R: Runtime>(app: &AppHandle<R>) -> bool {
    super::super::settings(app).island_always
        && !QUIET.load(Ordering::SeqCst)
        && windows::visible(app).is_none()
}

/// Kayro's window came or went, or the setting changed: the island follows.
pub fn sync<R: Runtime>(app: &AppHandle<R>) {
    if windows::visible(app).is_some() {
        QUIET.store(false, Ordering::SeqCst);
    }
    if wanted(app) {
        match windows::get(app, WIDGET) {
            Some(window) => appear(app, &window),
            None => build(app),
        }
    } else {
        leave(app);
    }
}

/// Builds the island's window hidden; it shows once its page has painted.
fn build<R: Runtime>(app: &AppHandle<R>) {
    use tauri::Manager;
    let screens = windows::screens(app);
    if screens.is_empty() {
        return;
    }
    let ui = app.state::<crate::config::ConfigState>().ui_state();
    let i = windows::choose_screen(app, &screens, &ui.widget, None);
    WANT.store(true, Ordering::SeqCst);
    match windows::create_widget(app, &screens[i], &ui.widget) {
        Ok(window) => super::super::attach_events(app, &window),
        Err(e) => {
            WANT.store(false, Ordering::SeqCst);
            tracing::error!(error = %e, "could not create the island");
        }
    }
}

/// The island's page has painted: it shows if it is still wanted.
pub fn page_ready<R: Runtime>(app: &AppHandle<R>) {
    if WANT.swap(false, Ordering::SeqCst) && wanted(app) {
        if let Some(window) = windows::get(app, WIDGET) {
            appear(app, &window);
        }
    }
}

fn tell<R: Runtime>(app: &AppHandle<R>, visible: bool) {
    let shown = super::super::WindowVisibility {
        visible,
        bench: false,
    };
    crate::ipc::notify(shown.emit_to(app, WIDGET));
}

/// On screen without taking the focus, unless a program in full screen is in front (it then
/// comes back with `on_foreground`).
fn appear<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let Ok(h) = window.hwnd() else { return };
    let raw = h.0 as isize;
    if win::full_screen_in_front(raw, std::process::id()) {
        DUCKED.store(true, Ordering::SeqCst);
        return;
    }
    DUCKED.store(false, Ordering::SeqCst);
    if window.is_visible().unwrap_or(false) {
        return;
    }
    tuck::reset();
    win::show_quietly(raw, true);
    crate::platform::own_window::set_tool_window(raw);
    tell(app, true);
}

/// Off the screen, its effects and the beat stopped.
fn leave<R: Runtime>(app: &AppHandle<R>) {
    WANT.store(false, Ordering::SeqCst);
    DUCKED.store(false, Ordering::SeqCst);
    stage::abort(app);
    tuck::reset();
    let Some(window) = windows::get(app, WIDGET) else {
        return;
    };
    effects::hide();
    crate::media::beat(app, false);
    if window.is_visible().unwrap_or(false) {
        if let Ok(h) = window.hwnd() {
            win::show_quietly(h.0 as isize, false);
        }
        tell(app, false);
    }
}

/// From the foreground hook: a program in full screen in front of the island's screen hides it;
/// it comes back (without taking the focus) once that program is no longer in front.
pub fn on_foreground<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = windows::get(app, WIDGET) else {
        DUCKED.store(false, Ordering::SeqCst);
        return;
    };
    let Ok(h) = window.hwnd() else { return };
    let raw = h.0 as isize;
    let cover = win::full_screen_in_front(raw, std::process::id());
    let ducked = DUCKED.load(Ordering::SeqCst);
    if cover && !ducked && window.is_visible().unwrap_or(false) {
        DUCKED.store(true, Ordering::SeqCst);
        stage::abort(app);
        tuck::reset();
        win::show_quietly(raw, false);
        effects::hide();
        crate::media::beat(app, false);
        // The page stops its loops (veille douce), as when the hub hides.
        tell(app, false);
        tracing::info!("island hidden: a program in full screen is in front");
    } else if !cover && ducked {
        DUCKED.store(false, Ordering::SeqCst);
        if wanted(app) {
            win::show_quietly(raw, true);
            crate::platform::own_window::set_tool_window(raw);
            tell(app, true);
            tracing::info!("island back");
        }
    }
}
