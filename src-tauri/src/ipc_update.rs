//! Step 18b: the commands and events of the updates (src/update.rs).

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime};
use tauri_specta::Event;

use crate::error::AppError;
use crate::ipc::notify;
use crate::update::{self, UpdateInfo};

/// A newer version was found by the automatic check (at start, if allowed).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct UpdateAvailable(pub UpdateInfo);

/// The download of an update: bytes so far, total when known.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    pub downloaded: u32,
    pub total: Option<u32>,
}

/// « Rechercher une mise à jour »: the only network request of Kayro, on demand.
#[tauri::command]
#[specta::specta]
pub async fn update_check<R: Runtime>(app: AppHandle<R>) -> Result<Option<UpdateInfo>, AppError> {
    update::check(&app).await
}

/// What the check at start found, if anything (asked by the page once it listens).
#[tauri::command]
#[specta::specta]
pub fn update_pending<R: Runtime>(app: AppHandle<R>) -> Option<UpdateInfo> {
    update::pending_info(&app)
}

/// Installs the update the last check found (Kayro quits, then starts again on it).
#[tauri::command]
#[specta::specta]
pub async fn update_install<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    let for_progress = app.clone();
    update::install(&app, move |downloaded, total| {
        let clamp = |n: u64| u32::try_from(n).unwrap_or(u32::MAX);
        notify(
            UpdateProgress {
                downloaded: clamp(downloaded),
                total: total.map(clamp),
            }
            .emit(&for_progress),
        );
    })
    .await
}

/// At start, when the user allowed it: one check, the page told if something newer exists.
pub fn check_at_start<R: Runtime>(app: &AppHandle<R>, allowed: bool) {
    if !allowed {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match update::check(&app).await {
            Ok(Some(info)) => notify(UpdateAvailable(info).emit(&app)),
            Ok(None) => {}
            Err(e) => tracing::warn!(error = %e, "update: automatic check failed"),
        }
    });
}
