//! Where the windows are: remembering placements, the screen of the immersive mode, and the
//! widget following the size of its content.

use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

use super::geometry;
use super::windows::{self, MAIN, WIDGET};
use super::{refit_immersive, settings};
use crate::config::schema::DisplayMode;
use crate::config::ConfigState;
use crate::error::AppError;

pub(super) fn save_placement<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    mode: DisplayMode,
) {
    let screens = windows::screens(app);
    let Some(placement) = windows::capture_placement(window, &screens) else {
        return;
    };
    let result = app.state::<ConfigState>().update_ui_state(|ui| {
        let slot = match mode {
            DisplayMode::Immersive => &mut ui.immersive,
            DisplayMode::Window => &mut ui.window,
            DisplayMode::Widget => &mut ui.widget,
        };
        let next = if mode == DisplayMode::Immersive {
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

/// Resizes the widget to its content (logical pixels), keeping its centre and top edge.
pub fn fit_widget<R: Runtime>(app: &AppHandle<R>, width: f64, height: f64) -> Result<(), AppError> {
    let Some(window) = windows::get(app, WIDGET) else {
        return Ok(());
    };
    let screens = windows::screens(app);
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = (
        (width * scale).ceil() as u32,
        (height * scale).ceil() as u32,
    );
    let pos = window.outer_position()?;
    let current = window.outer_size()?;
    let centre = (pos.x + (current.width / 2) as i32, pos.y);
    let work = geometry::screen_at(&screens, centre.0, centre.1)
        .or_else(|| {
            let ui = app.state::<ConfigState>().ui_state();
            geometry::find_screen(&screens, ui.widget.monitor.as_ref())
        })
        .map(|i| screens[i].work);
    let rect = crate::config::ui_state::Rect {
        x: pos.x,
        y: pos.y,
        width: current.width,
        height: current.height,
    };
    let next = match work {
        Some(work) => geometry::refit_widget(rect, size, work),
        None => crate::config::ui_state::Rect {
            width: size.0,
            height: size.1,
            ..rect
        },
    };
    let _ = window.set_position(tauri::PhysicalPosition::new(next.x, next.y));
    window.set_size(tauri::PhysicalSize::new(next.width, next.height))?;
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
