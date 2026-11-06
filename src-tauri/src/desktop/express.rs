//! Step 19, « Écran d'accueil »: started with Windows, the hub comes on screen at once on its
//! still logo, always in immersive mode (economy mode too). Whatever the user's mode, the window
//! stays immersive until it is first hidden (or the mode is changed), then goes back to it.
//! 2026-10-31: its screen goes dark with « Kayro · se réveille » at once (`wake`), before the page.

use std::sync::atomic::Ordering;
use std::time::Instant;

use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

use super::{create_for, lock, wake, windows, DesktopState};
use crate::config::schema::{DisplayMode, Settings};
use crate::config::ConfigState;

impl DesktopState {
    pub(crate) fn in_express_immersive(&self) -> bool {
        self.express_immersive.load(Ordering::SeqCst)
    }

    /// Ends the express start's immersive mode; true when it was on.
    pub(crate) fn end_express_immersive(&self) -> bool {
        self.express_immersive.swap(false, Ordering::SeqCst)
    }
}

/// Builds the immersive window; it shows itself once its page has painted (`page_ready`).
/// `logo`: it waits on its still logo (the intro); else its usual opening plays at once.
pub fn start<R: Runtime>(app: &AppHandle<R>, s: &Settings, logo: bool) {
    if logo {
        crate::ipc_desktop::OPENING.express_start();
    }
    tracing::info!(mode = ?s.display_mode, logo, "express start: the hub opens in immersive mode");
    let state = app.state::<DesktopState>();
    state.want_visible.store(true, Ordering::SeqCst);
    state
        .express_immersive
        .store(s.display_mode != DisplayMode::Immersive, Ordering::SeqCst);
    *lock(&state.building_since) = Some(Instant::now());
    let screens = windows::screens(app);
    if !screens.is_empty() {
        let ui = app.state::<ConfigState>().ui_state();
        let i = windows::opening_screen(app, &screens, &ui.immersive, None, s.opening_screen);
        wake::cover(app, &screens[i]);
    }
    if let Err(e) = create_for(app, DisplayMode::Immersive, false) {
        tracing::error!(error = %e, "could not create the window");
    }
}

/// « Après l'intro »: the intro's window goes; the island comes (`island`), or nothing until
/// Kayro is next shown.
pub fn intro_done<R: Runtime>(app: &AppHandle<R>, island: bool) {
    if !island {
        super::island::quiet();
    }
    super::hide(app);
}

/// The express start's immersive window, just hidden: back to the user's `mode` for the next show.
pub fn leave<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, mode: DisplayMode) {
    match mode {
        DisplayMode::Immersive => {}
        DisplayMode::Window => {
            let screens = windows::screens(app);
            if screens.is_empty() {
                return;
            }
            let ui = app.state::<ConfigState>().ui_state();
            let i = windows::choose_screen(app, &screens, &ui.window, Some(window));
            windows::configure_main(window, mode, &screens[i], &ui.window);
        }
    }
}
