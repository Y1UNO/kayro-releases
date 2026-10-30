//! Step 19, « Écran d'accueil »: started with Windows, the hub comes on screen at once on its
//! still logo, always in immersive mode (economy mode too). Whatever the user's mode, the window
//! stays immersive until it is first hidden (or the mode is changed), then goes back to it.

use std::sync::atomic::Ordering;
use std::time::Instant;

use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

use super::{create_for, lock, windows, DesktopState};
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
pub fn start<R: Runtime>(app: &AppHandle<R>, s: &Settings) {
    crate::ipc_desktop::OPENING.express_start();
    tracing::info!(mode = ?s.display_mode, "express start: the hub opens on its logo");
    let state = app.state::<DesktopState>();
    state.want_visible.store(true, Ordering::SeqCst);
    state
        .express_immersive
        .store(s.display_mode != DisplayMode::Immersive, Ordering::SeqCst);
    *lock(&state.building_since) = Some(Instant::now());
    if let Err(e) = create_for(app, DisplayMode::Immersive, false) {
        tracing::error!(error = %e, "could not create the window");
    }
}

/// The express start's immersive window, just hidden: back to the user's `mode` for the next show.
pub fn leave<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, mode: DisplayMode) {
    match mode {
        DisplayMode::Immersive => {}
        // The widget is another window, built at the next show.
        DisplayMode::Widget => {
            let _ = window.destroy();
        }
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
