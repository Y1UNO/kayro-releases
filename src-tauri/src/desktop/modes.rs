//! Settings that act on the windows: the display mode (with its passage, round 4b) and the
//! economy mode.

use std::sync::atomic::Ordering;

use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

use super::passage;
use super::windows::{self, MAIN, WIDGET};
use super::{create_for, lock, reveal, save_placement, settings, tray, DesktopState};
use crate::config::schema::{DisplayMode, Settings};
use crate::config::ConfigState;

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

/// Immersive ⇄ window on the same window: its place, size, frame and zoom.
fn reconfigure_main<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, mode: DisplayMode) {
    let screens = windows::screens(app);
    if screens.is_empty() {
        return;
    }
    let ui = app.state::<ConfigState>().ui_state();
    let saved = if mode == DisplayMode::Immersive {
        &ui.immersive
    } else {
        &ui.window
    };
    let i = windows::choose_screen(app, &screens, saved, Some(window));
    windows::configure_main(window, mode, &screens[i], &ui.window);
    if mode == DisplayMode::Immersive && window.is_focused().unwrap_or(false) {
        let _ = window.set_always_on_top(true);
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
        // Immersive ⇄ window: the same window. On screen, its page fades out first, the window
        // changes while nothing shows, then the page comes back (round 4b).
        let Some(window) = old_window else { return };
        if !window.is_visible().unwrap_or(false) {
            reconfigure_main(app, &window, new);
            return;
        }
        passage::fade_out_then(app, MAIN, |app, id| {
            // The latest mode wins (another change may have come in the meantime).
            let now = settings(&app).display_mode;
            if windows::label_for(now) != MAIN {
                return;
            }
            if let Some(window) = windows::get(&app, MAIN) {
                reconfigure_main(&app, &window, now);
            }
            passage::fade_in(&app, id, MAIN);
        });
        return;
    }
    // The widget is involved: another window, built hidden for a passage (its page enters on its
    // first show), then swapped in once painted (`page_ready` → `swap_after_fade`).
    let shown = windows::visible(app).is_some();
    if shown {
        *lock(&state.retire) = Some(old_label);
        state.want_visible.store(true, Ordering::SeqCst);
        if let Err(e) = create_for(app, new, true) {
            tracing::error!(error = %e, "could not create the window");
            *lock(&state.retire) = None;
            state.want_visible.store(false, Ordering::SeqCst);
        }
    } else {
        if let Some(w) = old_window {
            let _ = w.destroy();
        }
        if !settings(app).economy_mode {
            if let Err(e) = create_for(app, new, false) {
                tracing::error!(error = %e, "could not create the window");
            }
        }
    }
}

/// The new window of a passage has painted (hidden). When the window it replaces is on screen,
/// that one fades out first; then the new one is shown (and the old one retired by `reveal`).
/// False when there is nothing to fade (the caller reveals at once).
pub(super) fn swap_after_fade<R: Runtime>(app: &AppHandle<R>, new_label: &str) -> bool {
    let Some(old_label) = *lock(&app.state::<DesktopState>().retire) else {
        return false;
    };
    let old_shown = windows::get(app, old_label)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if !old_shown {
        return false;
    }
    let new_label = if new_label == WIDGET { WIDGET } else { MAIN };
    passage::fade_out_then(app, old_label, move |app, _| {
        if let Some(window) = windows::get(&app, new_label) {
            reveal(&app, &window);
        }
    });
    true
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
        if let Err(e) = create_for(app, now.display_mode, false) {
            tracing::error!(error = %e, "could not create the window");
        }
    }
}
