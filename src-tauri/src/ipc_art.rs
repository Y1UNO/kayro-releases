//! IPC of the local art (step 14): the index of every app's images, and the images the user gives
//! an app. The images themselves go through the `kayro-art` protocol, never through IPC.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, State};
use tauri_specta::Event;

use crate::art::user::{self, UserArtError};
use crate::art::{index, AppArt, ArtRole, ArtState};
use crate::config::ConfigState;
use crate::error::{AppError, ErrorCode};
use crate::ipc::notify;

/// Emitted when the user's images change (the whole index: a few hundred bytes per app).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct ArtChanged(pub Vec<AppArt>);

fn task_failed(e: impl std::fmt::Display) -> AppError {
    AppError::new(ErrorCode::Internal, format!("art task failed: {e}"))
}

fn fresh_index(config: &ConfigState, art: &ArtState) -> Vec<AppArt> {
    index(&art.roots, &config.apps().apps)
}

/// The images of every app (folder listings only, no image is read).
#[tauri::command]
#[specta::specta]
pub async fn art_index(
    config: State<'_, ConfigState>,
    art: State<'_, ArtState>,
) -> Result<Vec<AppArt>, AppError> {
    let (roots, apps) = (art.roots.clone(), config.apps().apps);
    tauri::async_runtime::spawn_blocking(move || index(&roots, &apps))
        .await
        .map_err(task_failed)
}

/// Copies a dropped image as the app's poster (or hero, logo), replacing the previous one.
#[tauri::command]
#[specta::specta]
pub async fn art_set_user<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    art: State<'_, ArtState>,
    id: String,
    role: ArtRole,
    path: String,
) -> Result<Vec<AppArt>, AppError> {
    if !config.apps().apps.iter().any(|a| a.id == id) {
        return Err(AppError::not_found(format!("app «{id}»")));
    }
    let root = art.roots.user.clone();
    let task_id = id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        user::set(&root, &task_id, role, std::path::Path::new(&path))
    })
    .await
    .map_err(task_failed)?
    .map_err(|e| match e {
        UserArtError::Write(_) => AppError::new(ErrorCode::Io, e.to_string()),
        _ => AppError::validation("path", e.to_string()),
    })?;
    tracing::info!(app = %id, role = role.slug(), "art: user image set");
    let fresh = fresh_index(&config, &art);
    notify(ArtChanged(fresh.clone()).emit(&app));
    Ok(fresh)
}

/// Forgets the user's image for `role` (Steam's comes back, if there is one).
#[tauri::command]
#[specta::specta]
pub async fn art_clear_user<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    art: State<'_, ArtState>,
    id: String,
    role: ArtRole,
) -> Result<Vec<AppArt>, AppError> {
    user::clear(&art.roots.user, &id, role)
        .map_err(|e| AppError::new(ErrorCode::Io, e.to_string()))?;
    let fresh = fresh_index(&config, &art);
    notify(ArtChanged(fresh.clone()).emit(&app));
    Ok(fresh)
}
