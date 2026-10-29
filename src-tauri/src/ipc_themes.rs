//! IPC of personal themes (step 15, registered in `ipc::builder`).

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, State};
use tauri_specta::Event;

use crate::config::schema::ThemeFile;
use crate::config::ConfigState;
use crate::error::AppError;
use crate::ipc::notify;

/// The personal themes changed (saved, imported or deleted): both windows read them again.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct ThemesChanged(pub Vec<ThemeFile>);

fn changed<R: Runtime>(app: &AppHandle<R>, state: &ConfigState) {
    notify(ThemesChanged(state.themes()).emit(app));
}

#[tauri::command]
#[specta::specta]
pub fn themes_list(state: State<'_, ConfigState>) -> Vec<ThemeFile> {
    state.themes()
}

/// A personal theme id no theme uses yet, derived from a name (the editor's first save).
#[tauri::command]
#[specta::specta]
pub fn theme_new_id(state: State<'_, ConfigState>, name: String) -> String {
    state.new_theme_id(&name)
}

#[tauri::command]
#[specta::specta]
pub fn theme_save<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    theme: ThemeFile,
) -> Result<ThemeFile, AppError> {
    let saved = state.save_theme(theme)?;
    changed(&app, &state);
    Ok(saved)
}

#[tauri::command]
#[specta::specta]
pub fn theme_delete<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    id: String,
) -> Result<(), AppError> {
    state.delete_theme(&id)?;
    changed(&app, &state);
    Ok(())
}

/// Imports a dropped `.json` theme file as a new personal theme. Nothing is run, only read.
#[tauri::command]
#[specta::specta]
pub fn theme_import<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    path: String,
) -> Result<ThemeFile, AppError> {
    let path = path.trim().trim_matches('"');
    let theme = state.import_theme(std::path::Path::new(path))?;
    tracing::info!(theme = %theme.id, "theme imported");
    changed(&app, &state);
    Ok(theme)
}

/// Writes `<id>.json` in the exports folder, shows it in Explorer and returns its path.
#[tauri::command]
#[specta::specta]
pub fn theme_export(state: State<'_, ConfigState>, id: String) -> Result<String, AppError> {
    let path = state.export_theme(&id, &state.paths().exports_dir())?;
    tracing::info!(theme = %id, file = %path.display(), "theme exported");
    crate::ipc_scenes::reveal(&path);
    Ok(path.display().to_string())
}
