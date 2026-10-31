//! Where the windows are: remembering placements and the screen of the immersive mode.

use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

use super::geometry;
use super::windows::{self, MAIN};
use super::{refit_immersive, settings};
use crate::config::schema::DisplayMode;
use crate::config::ConfigState;
use crate::error::AppError;

/// Remembers where `main` is, for `mode`.
pub(super) fn save_placement<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    mode: DisplayMode,
) {
    store(app, window, Some(mode));
}

/// Remembers where the island is.
pub(super) fn save_island_placement<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    store(app, window, None);
}

/// `mode`: `main`'s; None for the island.
fn store<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, mode: Option<DisplayMode>) {
    let screens = windows::screens(app);
    let Some(placement) = windows::capture_placement(window, &screens) else {
        return;
    };
    let result = app.state::<ConfigState>().update_ui_state(|ui| {
        let slot = match mode {
            Some(DisplayMode::Immersive) => &mut ui.immersive,
            Some(DisplayMode::Window) => &mut ui.window,
            None => &mut ui.widget,
        };
        let next = if mode == Some(DisplayMode::Immersive) {
            // Only the screen matters: the window is exactly that screen.
            crate::config::ui_state::Placement {
                monitor: placement.monitor,
                rect: None,
            }
        } else {
            placement
        };
        if *slot == next {
            return false;
        }
        *slot = next;
        true
    });
    if let Err(e) = result {
        tracing::warn!(error = %e, "could not save the window placement");
    }
}

/// Moves the immersive mode to another screen (`monitor` is a name from `monitors_list`).
pub fn choose_immersive_screen<R: Runtime>(app: &AppHandle<R>, name: &str) -> Result<(), AppError> {
    let screens = windows::screens(app);
    let screen = screens
        .iter()
        .find(|s| s.name.as_deref() == Some(name))
        .ok_or_else(|| AppError::not_found(format!("screen «{name}»")))?;
    let key = screen.key();
    app.state::<ConfigState>().update_ui_state(|ui| {
        ui.immersive.monitor = Some(key);
        true
    })?;
    if settings(app).display_mode == DisplayMode::Immersive {
        if let Some(window) = windows::get(app, MAIN) {
            refit_immersive(app, &window);
        }
    }
    Ok(())
}

/// Current screens, for the screen picker of the settings.
pub fn screen_names<R: Runtime>(app: &AppHandle<R>) -> Vec<(String, bool, u32, u32)> {
    let ui = app.state::<ConfigState>().ui_state();
    let screens = windows::screens(app);
    let chosen = geometry::find_screen(&screens, ui.immersive.monitor.as_ref());
    screens
        .iter()
        .enumerate()
        .map(|(i, s)| {
            (
                s.name.clone().unwrap_or_else(|| format!("{}", i + 1)),
                chosen == Some(i),
                s.rect.width,
                s.rect.height,
            )
        })
        .collect()
}
