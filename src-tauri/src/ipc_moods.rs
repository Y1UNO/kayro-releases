//! IPC of the ambiences (steps 16–17, registered in `ipc::builder`).

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, State};
use tauri_specta::Event;

use crate::config::moods::MoodFile;
use crate::config::ConfigState;
use crate::error::AppError;
use crate::ipc::notify;

/// The imported ambiences changed (imported or deleted): both windows read them again.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct MoodsChanged(pub Vec<MoodFile>);

fn changed<R: Runtime>(app: &AppHandle<R>, state: &ConfigState) {
    notify(MoodsChanged(state.moods()).emit(app));
}

/// The user's imported ambiences (the built-in packs live in the page).
#[tauri::command]
#[specta::specta]
pub fn moods_list(state: State<'_, ConfigState>) -> Vec<MoodFile> {
    state.moods()
}

/// Imports a dropped `.hubmood` file. Nothing is run, only read and checked.
#[tauri::command]
#[specta::specta]
pub fn mood_import<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    path: String,
) -> Result<MoodFile, AppError> {
    let path = path.trim().trim_matches('"');
    let mood = state.import_mood(std::path::Path::new(path))?;
    tracing::info!(mood = %mood.id, "ambience imported");
    changed(&app, &state);
    Ok(mood)
}

#[tauri::command]
#[specta::specta]
pub fn mood_delete<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    id: String,
) -> Result<(), AppError> {
    state.delete_mood(&id)?;
    changed(&app, &state);
    Ok(())
}

/// Writes the ambience in the exports folder, shows it in Explorer and returns its path.
#[tauri::command]
#[specta::specta]
pub fn mood_export(state: State<'_, ConfigState>, mood: MoodFile) -> Result<String, AppError> {
    let path = crate::config::mood_store::export_mood(&mood, &state.paths().exports_dir())?;
    tracing::info!(mood = %mood.id, file = %path.display(), "ambience exported");
    crate::ipc_scenes::reveal(&path);
    Ok(path.display().to_string())
}
