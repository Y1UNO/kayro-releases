//! IPC of the scene engine and of slots (registered in `ipc::builder`).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_specta::Event;

use crate::config::scene_ops::ImportPreview;
use crate::config::schema::{SceneFile, SlotsFile};
use crate::config::share;
use crate::config::ConfigState;
use crate::error::AppError;
use crate::ipc::notify;
use crate::launcher::system::SystemLauncher;
use crate::procwatch::{ProcWatch, RunningApps};
use crate::scenes::action::Env;
use crate::scenes::clock::RealClock;
use crate::scenes::exec::execute;
use crate::scenes::{ProgressEvent, SceneRunner};

/// Progress of the scene being played: one event per step change, plus its start and end.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct SceneProgress(pub ProgressEvent);

#[tauri::command]
#[specta::specta]
pub fn scenes_list(state: State<'_, ConfigState>) -> Vec<SceneFile> {
    state.scenes()
}

#[tauri::command]
#[specta::specta]
pub fn scenes_save<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    scene: SceneFile,
) -> Result<SceneFile, AppError> {
    let saved = state.save_scene(scene)?;
    crate::desktop::scenes_changed(&app);
    Ok(saved)
}

#[tauri::command]
#[specta::specta]
pub fn slots_get(state: State<'_, ConfigState>) -> SlotsFile {
    state.slots()
}

/// Replaces all slots (slot name → app id).
#[tauri::command]
#[specta::specta]
pub fn slots_set(
    state: State<'_, ConfigState>,
    slots: BTreeMap<String, String>,
) -> Result<SlotsFile, AppError> {
    state.set_slots(slots)
}

/// `ProcWatch` is managed by Tauri, not shared: the scene thread reaches it through the handle.
struct TauriRunning<R: Runtime>(AppHandle<R>);

impl<R: Runtime> RunningApps for TauriRunning<R> {
    fn pids_of(&self, id: &str) -> Vec<u32> {
        self.0.state::<ProcWatch>().pids_of(id)
    }
    fn bring_to_front(&self, pids: &[u32]) -> bool {
        self.0.state::<ProcWatch>().bring_to_front(pids)
    }
    fn note_launch(&self) {
        self.0.state::<ProcWatch>().note_launch();
    }
    fn is_followed(&self, id: &str) -> bool {
        self.0.state::<ProcWatch>().is_followed(id)
    }
    fn close_softly(&self, pids: &[u32]) -> bool {
        self.0.state::<ProcWatch>().close_softly(pids)
    }
}

/// Starts a scene and returns its run id at once; progress arrives as `SceneProgress` events.
/// `close_confirmed` must be true only after the interface showed the user which apps `close`
/// steps will ask to close. One scene at a time (`busy` otherwise).
#[tauri::command]
#[specta::specta]
pub fn scene_run<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    runner: State<'_, SceneRunner>,
    id: String,
    close_confirmed: bool,
) -> Result<u32, AppError> {
    start_scene(&app, &config, &runner, &id, close_confirmed)
}

/// What `scene_run` does, also used by scene shortcuts and the notification-area menu.
pub fn start_scene<R: Runtime>(
    app: &AppHandle<R>,
    config: &ConfigState,
    runner: &SceneRunner,
    id: &str,
    close_confirmed: bool,
) -> Result<u32, AppError> {
    let scene = config
        .scene(id)
        .ok_or_else(|| AppError::not_found(format!("scene «{id}»")))?;
    let (apps, slots) = (config.apps().apps, config.slots().slots);
    let app = app.clone();
    runner.start(move |run_id, cancel| {
        let (running, clock) = (TauriRunning(app.clone()), RealClock::new());
        let env = Env {
            launcher: &SystemLauncher,
            running: &running,
            clock: &clock,
            cancel,
            apps: &apps,
            slots: &slots,
            close_confirmed,
        };
        execute(&scene, run_id, &env, &|event| {
            notify(SceneProgress(event).emit(&app));
        });
    })
}

/// Cancels the scene being played (false when none is). Takes effect within milliseconds,
/// except while Windows is showing an administrator prompt for a `launch`.
#[tauri::command]
#[specta::specta]
pub fn scene_cancel(runner: State<'_, SceneRunner>) -> bool {
    runner.cancel()
}

/// Deletes a scene (its file included). Its slots stay: other scenes may use them.
#[tauri::command]
#[specta::specta]
pub fn scenes_delete<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    id: String,
) -> Result<(), AppError> {
    state.delete_scene(&id)?;
    crate::desktop::scenes_changed(&app);
    Ok(())
}

/// A scene id that no scene uses yet, derived from a name (used on the first save).
#[tauri::command]
#[specta::specta]
pub fn scenes_new_id(state: State<'_, ConfigState>, name: String) -> String {
    state.new_scene_id(&name)
}

/// Writes `<id>.hubscene` (slot names only) in the exports folder, shows it in Explorer and
/// returns its path. Never overwrites an earlier export.
#[tauri::command]
#[specta::specta]
pub fn scene_export(state: State<'_, ConfigState>, id: String) -> Result<String, AppError> {
    let scene = state
        .scene(&id)
        .ok_or_else(|| AppError::not_found(format!("scene «{id}»")))?;
    let path = share::write_export(&state.paths().exports_dir(), &scene)?;
    tracing::info!(scene = %id, file = %path.display(), "scene exported");
    reveal(&path);
    Ok(path.display().to_string())
}

/// Reads and validates a `.hubscene` file and says which slots it needs. Writes nothing.
#[tauri::command]
#[specta::specta]
pub fn scene_import_preview(
    state: State<'_, ConfigState>,
    path: String,
) -> Result<ImportPreview, AppError> {
    let file = read_shared(&path)?;
    Ok(state.preview_import(&file))
}

/// Imports a `.hubscene` file as a new scene; `links` maps its slot names to the user's apps.
#[tauri::command]
#[specta::specta]
pub fn scene_import<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    path: String,
    links: BTreeMap<String, String>,
) -> Result<SceneFile, AppError> {
    let file = read_shared(&path)?;
    let scene = state.import_scene(&file, &links)?;
    tracing::info!(scene = %scene.id, slots = file.slots.len(), "scene imported");
    crate::desktop::scenes_changed(&app);
    Ok(scene)
}

fn read_shared(path: &str) -> Result<share::HubSceneFile, AppError> {
    let path = path.trim().trim_matches('"');
    share::read(std::path::Path::new(path)).map_err(|reason| {
        tracing::warn!(%reason, "scene file refused");
        AppError::validation("file", reason)
    })
}

/// Selects the file in Explorer. Best effort: the export is already written.
fn reveal(path: &std::path::Path) {
    let mut arg = std::ffi::OsString::from("/select,");
    arg.push(path);
    if let Err(e) = std::process::Command::new("explorer.exe").arg(arg).spawn() {
        tracing::warn!(error = %e, "could not show the export in Explorer");
    }
}
