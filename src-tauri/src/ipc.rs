//! Typed IPC surface: every command and event the interface can use. `builder()` is shared by
//! the app and by `gen_types`, so the generated `src/ipc/bindings.ts` can never drift; only
//! `npm run gen:types` writes it (a test fails when it is out of date).

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_specta::{collect_commands, collect_events, Builder, Event};

use crate::config::apps::{AddReport, AppEntry, AppsFile, NewApp};
use crate::config::schema::{Settings, SettingsPatch};
use crate::config::ConfigState;
use crate::detect::default_sources;
use crate::detect::scan::{run_scan, DetectProgress, DetectState, ScanReport};
use crate::error::{AppError, ErrorCode};
use crate::intake::{inspect, shortcut_target, InspectReport};
use crate::launcher::system::SystemLauncher;
use crate::launcher::{launch_app, LaunchResult};
use crate::procwatch::{AppRunState, ProcWatch, RunningApps};
use crate::{icons, ipc_art, ipc_desktop, ipc_moods, ipc_scenes, ipc_themes, platform};

/// Emitted after every successful change of the settings (also to the window that made it).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct SettingsChanged(pub Settings);

/// Emitted after every successful change of the app list.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct AppsChanged(pub AppsFile);

/// Emitted when an app starts, stops, or comes to / leaves the front (changes only).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct AppStateChanged(pub AppRunState);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FocusResult {
    Focused,
    /// No process of this app is known (or the app cannot be followed).
    NotRunning,
    /// Running, but no window could be brought forward (tray app, other privileges…).
    Failed,
}

#[tauri::command]
#[specta::specta]
pub fn ping() -> String {
    "pong".into()
}

/// Called by the UI after its first paint: a window that was built to be shown stays hidden
/// until then (no white flash). A window started silently (`--silent`) or built in advance for
/// the shortcut is not shown. True when the page must report its paint time (measurement).
#[tauri::command]
#[specta::specta]
pub async fn app_ready<R: Runtime>(app: AppHandle<R>, window: tauri::WebviewWindow<R>) -> bool {
    crate::desktop::page_ready(&app, window.label())
}

#[tauri::command]
#[specta::specta]
pub fn settings_get(state: State<'_, ConfigState>) -> Settings {
    state.settings()
}

#[tauri::command]
#[specta::specta]
pub async fn settings_set<R: Runtime>(
    app: AppHandle<R>,
    patch: SettingsPatch,
) -> Result<Settings, AppError> {
    // Async on purpose: a mode change builds a window, and building one from a synchronous
    // command (which runs on the main thread, inside the page's own message) hangs on Windows.
    update_settings(&app, patch)
}

/// Saves a settings change, tells every window, and lets the desktop act on it (display mode,
/// economy mode). Also used by the notification-area menu.
pub(crate) fn update_settings<R: Runtime>(
    app: &AppHandle<R>,
    patch: SettingsPatch,
) -> Result<Settings, AppError> {
    let state = app.state::<ConfigState>();
    let old = state.settings();
    let settings = state.set_settings(patch)?;
    notify(SettingsChanged(settings.clone()).emit(app));
    crate::desktop::settings_changed(app, &old, &settings);
    Ok(settings)
}

#[tauri::command]
#[specta::specta]
pub fn apps_list(state: State<'_, ConfigState>) -> Vec<AppEntry> {
    state.apps().apps
}

#[tauri::command]
#[specta::specta]
pub fn apps_add<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    new_app: NewApp,
) -> Result<AppEntry, AppError> {
    let entry = state.add_app(new_app)?;
    apps_changed(&app, &state);
    Ok(entry)
}

#[tauri::command]
#[specta::specta]
pub fn apps_update<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    entry: AppEntry,
) -> Result<AppEntry, AppError> {
    let entry = state.update_app(entry)?;
    apps_changed(&app, &state);
    Ok(entry)
}

#[tauri::command]
#[specta::specta]
pub fn apps_remove<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    id: String,
) -> Result<(), AppError> {
    state.remove_app(&id)?;
    icons::forget(&state.paths().icons_dir(), &id);
    apps_changed(&app, &state);
    Ok(())
}

/// Adds several apps with a single write (the detected-apps tab, a multi-file drop). One app
/// being refused never stops the others: see `AddReport::failed`.
#[tauri::command]
#[specta::specta]
pub fn apps_add_many<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    new_apps: Vec<NewApp>,
) -> Result<AddReport, AppError> {
    let report = state.add_apps(new_apps)?;
    if !report.added.is_empty() {
        apps_changed(&app, &state);
    }
    Ok(report)
}

/// Looks at files and addresses that were dropped or pasted and proposes apps. Read-only:
/// nothing is started and nothing is added.
#[tauri::command]
#[specta::specta]
pub async fn apps_inspect(
    config: State<'_, ConfigState>,
    inputs: Vec<String>,
) -> Result<InspectReport, AppError> {
    let existing = config.apps().apps;
    tauri::async_runtime::spawn_blocking(move || inspect(&inputs, &existing, &shortcut_target))
        .await
        .map_err(|e| AppError::new(ErrorCode::Internal, format!("inspect task failed: {e}")))
}

/// Icon of an app as a `data:` URL, or `None` when it has none (links, protocols, packaged apps,
/// unreadable programs): the card then keeps its monogram.
#[tauri::command]
#[specta::specta]
pub async fn app_icon(
    config: State<'_, ConfigState>,
    id: String,
) -> Result<Option<String>, AppError> {
    let entry = find_app(&config, &id)?;
    let dir = config.paths().icons_dir();
    tauri::async_runtime::spawn_blocking(move || {
        icons::icon_png(&dir, &entry, &|path| platform::icon::shell_icon(path))
            .map(|png| icons::png_data_url(&png))
    })
    .await
    .map_err(|e| AppError::new(ErrorCode::Internal, format!("icon task failed: {e}")))
}

/// Looks for installed apps (Steam, Epic, Start Menu). Read-only: nothing is added. Starting a
/// scan cancels the one in progress; progress arrives as `DetectProgress` events.
#[tauri::command]
#[specta::specta]
pub async fn detect_scan<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    detect: State<'_, DetectState>,
) -> Result<ScanReport, AppError> {
    let existing = config.apps().apps;
    let ignored = config.settings().ignored_detections;
    let token = detect.begin();
    let scan_token = token.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let sources = default_sources();
        let mut report = run_scan(&sources, &existing, &scan_token, &|progress| {
            notify(progress.emit(&app));
        });
        crate::detect::tidy::mark_ignored(&mut report, &ignored);
        report
    })
    .await;
    detect.finish(&token);
    result.map_err(|e| AppError::new(ErrorCode::Internal, format!("scan task failed: {e}")))
}

/// Stops the scan in progress, if any (the pending `detect_scan` then returns what it has).
#[tauri::command]
#[specta::specta]
pub fn detect_cancel(detect: State<'_, DetectState>) {
    detect.cancel();
}

/// Tells the interface the list changed, and the process watcher to look at the new list.
pub(crate) fn apps_changed<R: Runtime>(app: &AppHandle<R>, state: &ConfigState) {
    notify(AppsChanged(state.apps()).emit(app));
    if let Some(palettes) = app.try_state::<ipc_art::PaletteWorker>() {
        palettes.request(app);
    }
    if let Some(watch) = app.try_state::<ProcWatch>() {
        watch.refresh();
    }
}

/// Starts an app, or brings it to the front when it is already open. Runs off the interface
/// thread (an administrator prompt can wait for the user).
#[tauri::command]
#[specta::specta]
pub async fn app_launch<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    id: String,
) -> Result<LaunchResult, AppError> {
    let entry = find_app(&config, &id)?;
    let for_task = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let watch = for_task.state::<ProcWatch>();
        launch_app(&SystemLauncher, &*watch, &entry)
    })
    .await
    .map_err(|e| AppError::new(ErrorCode::Internal, format!("launch task failed: {e}")))?
    .map_err(AppError::from)?;
    crate::ipc_desktop::note_recent(&app, &config, &id);
    Ok(result)
}

/// Brings an already running app to the front, without starting anything.
#[tauri::command]
#[specta::specta]
pub async fn app_focus<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    id: String,
) -> Result<FocusResult, AppError> {
    find_app(&config, &id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let watch = app.state::<ProcWatch>();
        let pids = watch.pids_of(&id);
        if pids.is_empty() {
            FocusResult::NotRunning
        } else if watch.bring_to_front(&pids) {
            FocusResult::Focused
        } else {
            FocusResult::Failed
        }
    })
    .await
    .map_err(|e| AppError::new(ErrorCode::Internal, format!("focus task failed: {e}")))
}

/// State of every app that can be followed (an app without a way to recognise its process
/// is simply absent).
#[tauri::command]
#[specta::specta]
pub fn apps_running(watch: State<'_, ProcWatch>) -> Vec<AppRunState> {
    watch.apps_running()
}

fn find_app(config: &ConfigState, id: &str) -> Result<crate::config::apps::AppEntry, AppError> {
    config
        .apps()
        .apps
        .into_iter()
        .find(|a| a.id == id)
        .ok_or_else(|| AppError::not_found(format!("app «{id}»")))
}

/// A failed notification never fails the command: the change is already saved.
pub(crate) fn notify(result: tauri::Result<()>) {
    if let Err(e) = result {
        tracing::warn!(error = %e, "could not emit an event");
    }
}

pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            ping,
            app_ready::<tauri::Wry>,
            settings_get,
            settings_set::<tauri::Wry>,
            apps_list,
            apps_add::<tauri::Wry>,
            apps_update::<tauri::Wry>,
            apps_remove::<tauri::Wry>,
            apps_add_many::<tauri::Wry>,
            apps_inspect,
            app_icon,
            detect_scan::<tauri::Wry>,
            detect_cancel,
            app_launch::<tauri::Wry>,
            app_focus::<tauri::Wry>,
            apps_running,
            ipc_scenes::scenes_list,
            ipc_scenes::scenes_save::<tauri::Wry>,
            ipc_scenes::slots_get,
            ipc_scenes::slots_set,
            ipc_scenes::scene_run::<tauri::Wry>,
            ipc_scenes::scene_cancel,
            ipc_scenes::scenes_delete::<tauri::Wry>,
            ipc_scenes::scenes_new_id,
            ipc_scenes::scene_export,
            ipc_scenes::scene_import_preview,
            ipc_scenes::scene_import::<tauri::Wry>,
            ipc_desktop::window_hide::<tauri::Wry>,
            ipc_desktop::window_drag::<tauri::Wry>,
            ipc_desktop::window_painted::<tauri::Wry>,
            ipc_desktop::widget_fit::<tauri::Wry>,
            ipc_desktop::monitors_list::<tauri::Wry>,
            ipc_desktop::monitor_choose::<tauri::Wry>,
            ipc_desktop::hotkey_set::<tauri::Wry>,
            ipc_desktop::hotkeys_get,
            ipc_desktop::scene_hotkey_take::<tauri::Wry>,
            ipc_desktop::autostart_get::<tauri::Wry>,
            ipc_desktop::autostart_set::<tauri::Wry>,
            ipc_desktop::logs_export::<tauri::Wry>,
            ipc_desktop::recents_get,
            ipc_desktop::opening_due::<tauri::Wry>,
            ipc_desktop::passage_faded::<tauri::Wry>,
            ipc_art::art_index,
            ipc_art::art_set_user::<tauri::Wry>,
            ipc_art::art_clear_user::<tauri::Wry>,
            ipc_art::palettes_get,
            ipc_themes::themes_list,
            ipc_themes::theme_new_id,
            ipc_themes::theme_save::<tauri::Wry>,
            ipc_themes::theme_delete::<tauri::Wry>,
            ipc_themes::theme_import::<tauri::Wry>,
            ipc_themes::theme_export,
            ipc_moods::moods_list,
            ipc_moods::mood_import::<tauri::Wry>,
            ipc_moods::mood_delete::<tauri::Wry>,
            ipc_moods::mood_export,
            ipc_desktop::launch_cover::<tauri::Wry>,
            crate::ipc_detect::detect_icon,
            crate::ipc_detect::apps_reorder::<tauri::Wry>,
            crate::ipc_startup::startup_apps,
            crate::ipc_startup::startup_app_set,
            crate::ipc_startup::startup_apps_restore,
            crate::ipc_update::update_check::<tauri::Wry>,
            crate::ipc_update::update_pending::<tauri::Wry>,
            crate::ipc_update::update_install::<tauri::Wry>,
        ])
        .events(collect_events![
            SettingsChanged,
            AppsChanged,
            DetectProgress,
            AppStateChanged,
            ipc_scenes::SceneProgress,
            crate::desktop::WindowVisibility,
            crate::desktop::passage::ModePassage,
            crate::desktop::SceneHotkey,
            crate::desktop::hotkeys::HotkeysChanged,
            ipc_desktop::RecentsChanged,
            ipc_art::ArtChanged,
            ipc_art::PalettesChanged,
            ipc_themes::ThemesChanged,
            ipc_moods::MoodsChanged,
            crate::desktop::cover::LaunchLanded,
            crate::ipc_update::UpdateAvailable,
            crate::ipc_update::UpdateProgress
        ])
}

#[cfg(test)]
#[path = "ipc_tests.rs"]
mod tests;
