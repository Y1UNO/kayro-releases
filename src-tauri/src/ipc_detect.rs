//! Step 19b, the library made easier: the icon of an app the scan proposes (not in the library
//! yet), so that the « Ajouter des applications » list shows each app's own logo — same sources as
//! the cards: the Shell icon of the program or shortcut, Steam's small icon for a Steam game, off
//! the interface thread — and the apps put in a new order (the order of the cards).

use tauri::{AppHandle, Runtime, State};

use crate::art::{locate, ArtRole, ArtState};
use crate::config::apps::{AppSource, AppsFile};
use crate::config::ConfigState;
use crate::detect::DetectedApp;
use crate::error::{AppError, ErrorCode};
use crate::{icons, platform};

/// `data:` URL of the icon of `app`, or none.
#[tauri::command]
#[specta::specta]
pub async fn detect_icon(
    config: State<'_, ConfigState>,
    art: State<'_, ArtState>,
    app: DetectedApp,
) -> Result<Option<String>, AppError> {
    let dir = config.paths().icons_dir();
    let steam_cache = art.roots.steam_cache.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let AppSource::Steam { app_id } = &app.source {
            let found = steam_cache.and_then(|c| locate::steam(&c, app_id, ArtRole::Icon))?;
            let bytes = std::fs::read(found.path).ok()?;
            return Some(icons::data_url("image/jpeg", &bytes));
        }
        let source = icons::icon_source_for(&app.launch, &app.source)?;
        icons::icon_png_from(&dir, &app.id, source, &|path| platform::icon::shell_icon(path))
            .map(|png| icons::png_data_url(&png))
    })
    .await
    .map_err(|e| AppError::new(ErrorCode::Internal, format!("icon task failed: {e}")))
}

/// The apps in the order of `ids` (every app's id, each once).
#[tauri::command]
#[specta::specta]
pub fn apps_reorder<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    ids: Vec<String>,
) -> Result<AppsFile, AppError> {
    let file = state.reorder_apps(&ids)?;
    crate::ipc::apps_changed(&app, &state);
    Ok(file)
}
