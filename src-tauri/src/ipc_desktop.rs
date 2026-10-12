//! IPC of the desktop side: hiding, dragging and fitting the widget, screens, shortcuts, starting
//! with Windows, recent apps (registered in `ipc::builder`).

use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, State, WebviewWindow};
use tauri_plugin_autostart::ManagerExt;
use tauri_specta::Event;

use crate::config::schema::SettingsPatch;
use crate::config::ConfigState;
use crate::desktop::hotkeys::{self, HotkeyProblem, HotkeysReport};
use crate::error::{AppError, ErrorCode};
use crate::ipc::{notify, update_settings};

/// Emitted when the list of recently launched apps changes (most recent first).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct RecentsChanged(pub Vec<String>);

/// Remembers a launch for the « récents » list. A failure to save never fails the launch.
pub fn note_recent<R: Runtime>(app: &AppHandle<R>, config: &ConfigState, id: &str) {
    let mut changed = false;
    let saved = config.update_ui_state(|ui| {
        changed = ui.push_recent(id);
        changed
    });
    match saved {
        Ok(()) if changed => notify(RecentsChanged(config.ui_state().recents).emit(app)),
        Ok(()) => {}
        Err(e) => tracing::warn!(error = %e, "could not save the recent apps"),
    }
}

static OPENING_PLAYED: AtomicBool = AtomicBool::new(false);

/// Whether the opening animation plays now: once per run of the program, at the first time the
/// main window is on screen (a silent start waits for the first show; in economy mode the window
/// is built again at every show, so the page cannot remember it itself).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum OpeningDue {
    /// Play it now (asked once: the next answers are `No`).
    Now,
    /// Not played yet but the window is hidden: ask again when it is shown.
    Later,
    No,
}

fn opening_due_for(visible: bool) -> OpeningDue {
    if OPENING_PLAYED.load(Ordering::SeqCst) {
        OpeningDue::No
    } else if !visible {
        OpeningDue::Later
    } else if OPENING_PLAYED.swap(true, Ordering::SeqCst) {
        OpeningDue::No
    } else {
        OpeningDue::Now
    }
}

#[tauri::command]
#[specta::specta]
pub fn opening_due<R: Runtime>(window: WebviewWindow<R>) -> OpeningDue {
    opening_due_for(window.is_visible().unwrap_or(true))
}

#[tauri::command]
#[specta::specta]
pub fn recents_get(config: State<'_, ConfigState>) -> Vec<String> {
    config.ui_state().recents
}

/// Hides the hub (Escape, the widget's own button…).
#[tauri::command]
#[specta::specta]
pub async fn window_hide<R: Runtime>(app: AppHandle<R>) {
    // Async: in economy mode the window that sent this call is destroyed.
    crate::desktop::hide(&app);
}

/// The page has faded out for passage `id` (round 4b: a change of display mode on screen); the
/// core goes on with the window. `veil`: how the native veil fades when the widget is involved.
#[tauri::command]
#[specta::specta]
pub fn passage_faded<R: Runtime>(
    app: AppHandle<R>,
    id: u32,
    veil: Option<crate::desktop::passage::VeilFade>,
) {
    crate::desktop::passage::faded(&app, id, veil);
}

/// Starts moving the calling window with the mouse (the widget has no title bar).
#[tauri::command]
#[specta::specta]
pub fn window_drag<R: Runtime>(window: WebviewWindow<R>) -> Result<(), AppError> {
    Ok(window.start_dragging()?)
}

/// The page tells it painted after being shown (measurement only, see `KAYRO_BENCH_SHOW`).
#[tauri::command]
#[specta::specta]
pub fn window_painted<R: Runtime>(app: AppHandle<R>) {
    crate::desktop::painted(&app);
}

/// Resizes the widget window to its content, in logical pixels.
#[tauri::command]
#[specta::specta]
pub fn widget_fit<R: Runtime>(app: AppHandle<R>, width: f64, height: f64) -> Result<(), AppError> {
    let sane = |v: f64| v.is_finite() && (1.0..=4000.0).contains(&v);
    if !sane(width) || !sane(height) {
        return Err(AppError::validation("size", "size out of range"));
    }
    crate::desktop::fit_widget(&app, width, height)
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    /// The screen the immersive mode uses.
    pub chosen: bool,
}

#[tauri::command]
#[specta::specta]
pub fn monitors_list<R: Runtime>(app: AppHandle<R>) -> Vec<MonitorInfo> {
    crate::desktop::screen_names(&app)
        .into_iter()
        .map(|(name, chosen, width, height)| MonitorInfo {
            name,
            width,
            height,
            chosen,
        })
        .collect()
}

/// Picks the screen of the immersive mode (a `name` from `monitors_list`).
#[tauri::command]
#[specta::specta]
pub fn monitor_choose<R: Runtime>(app: AppHandle<R>, name: String) -> Result<(), AppError> {
    crate::desktop::choose_immersive_screen(&app, &name)
}

/// Changes the show/hide shortcut. Refused (`hotkeyConflict`) when another program owns the
/// combination: nothing changes then.
#[tauri::command]
#[specta::specta]
pub async fn hotkey_set<R: Runtime>(app: AppHandle<R>, hotkey: String) -> Result<(), AppError> {
    match hotkeys::set_toggle(&app, &hotkey) {
        Ok(()) => {}
        Err(HotkeyProblem::Invalid) => {
            return Err(AppError::validation("hotkey", "not a valid shortcut"));
        }
        Err(HotkeyProblem::Conflict) => {
            return Err(AppError::new(
                ErrorCode::HotkeyConflict,
                format!("{hotkey} is already used"),
            ));
        }
    }
    update_settings(
        &app,
        SettingsPatch {
            hotkey: Some(hotkey),
            ..Default::default()
        },
    )?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn hotkeys_get(state: State<'_, hotkeys::HotkeyState>) -> HotkeysReport {
    state.report()
}

/// The scene a shortcut asked to confirm, if the page was not there to hear the event.
#[tauri::command]
#[specta::specta]
pub fn scene_hotkey_take<R: Runtime>(app: AppHandle<R>) -> Option<String> {
    crate::desktop::take_pending_scene(&app)
}

/// Whether Windows starts the hub at login (the Run key is the source of truth).
#[tauri::command]
#[specta::specta]
pub fn autostart_get<R: Runtime>(app: AppHandle<R>) -> Result<bool, AppError> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| AppError::new(ErrorCode::Internal, e.to_string()))
}

#[tauri::command]
#[specta::specta]
pub fn autostart_set<R: Runtime>(app: AppHandle<R>, enabled: bool) -> Result<bool, AppError> {
    let launch = app.autolaunch();
    let result = if enabled {
        launch.enable()
    } else {
        launch.disable()
    };
    result.map_err(|e| AppError::new(ErrorCode::Internal, e.to_string()))?;
    if !enabled {
        crate::platform::startup::forget_startup_approval(&app.package_info().name);
    }
    tracing::info!(enabled, "start with Windows changed");
    autostart_get(app)
}

#[cfg(test)]
mod tests {
    use super::{opening_due_for, OpeningDue};

    #[test]
    fn the_opening_is_due_once_per_run_at_the_first_show() {
        assert_eq!(opening_due_for(false), OpeningDue::Later);
        assert_eq!(opening_due_for(false), OpeningDue::Later);
        assert_eq!(opening_due_for(true), OpeningDue::Now);
        assert_eq!(opening_due_for(true), OpeningDue::No);
        assert_eq!(opening_due_for(false), OpeningDue::No);
    }
}
