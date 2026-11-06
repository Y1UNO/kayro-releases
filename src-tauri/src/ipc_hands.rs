//! Step 22, the hands: where they stand, turning the camera on and off, and their models
//! (downloaded on demand, removed on demand).

use tauri::{AppHandle, Runtime};

use crate::error::{AppError, ErrorCode};
use crate::hands::models::{self, HandsModelInfo};
use crate::hands::HandsState;

/// Where the hands stand (the page asks once at load, then follows `HandsStateChanged`).
#[tauri::command]
#[specta::specta]
pub fn hands_state() -> HandsState {
    crate::hands::state()
}

/// Turns the camera on or off (as the shortcut does). Refused while the hands are not set up.
#[tauri::command]
#[specta::specta]
pub fn hands_set_on<R: Runtime>(app: AppHandle<R>, on: bool) {
    crate::hands::set_on(&app, on);
}

#[tauri::command]
#[specta::specta]
pub fn hands_model() -> HandsModelInfo {
    models::info()
}

/// Downloads the two models (the user's click: the hands' only network). Progress:
/// `VoiceModelProgress` with the id « hands ».
#[tauri::command]
#[specta::specta]
pub async fn hands_model_download<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    models::download(&app)
        .await
        .map_err(|e| AppError::new(ErrorCode::DownloadFailed, e))
}

#[tauri::command]
#[specta::specta]
pub fn hands_model_cancel() {
    models::cancel();
}

/// Removes the models; the camera is turned off first (the page asked the user), and the thread
/// lets the models go before their files are deleted.
#[tauri::command]
#[specta::specta]
pub async fn hands_model_remove<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    crate::hands::set_on(&app, false);
    // The thread drops its models within a frame of the camera closing.
    tauri::async_runtime::spawn_blocking(|| {
        std::thread::sleep(std::time::Duration::from_millis(300))
    })
    .await
    .ok();
    let removed = models::remove().map_err(|e| AppError::new(ErrorCode::Io, e));
    crate::hands::models_changed(&app);
    removed
}
