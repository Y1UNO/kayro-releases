//! Step 18b, updates: look for a newer Kayro (the signed `latest.json` of the project's releases,
//! the only network Kayro does, and only when asked or allowed), then download it, check its
//! signature against the key built into Kayro, and install it (Kayro quits, the installer runs
//! without a question, Kayro starts again). The installer's choice « look for updates
//! automatically » reaches the settings through `install-choices.json`.

use std::path::Path;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::config::schema::SettingsPatch;
use crate::config::ConfigState;
use crate::error::{AppError, ErrorCode};

/// A newer version, as the release describes it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current: String,
    /// The release's notes (its patch notes), plain text, one point per line.
    pub notes: Option<String>,
}

/// The update found by the last check, kept for `install`.
#[derive(Default)]
pub struct PendingUpdate(pub Mutex<Option<Update>>);

fn failed(e: impl std::fmt::Display) -> AppError {
    AppError::new(ErrorCode::UpdateFailed, e.to_string())
}

fn info_of(u: &Update) -> UpdateInfo {
    UpdateInfo {
        version: u.version.clone(),
        current: u.current_version.clone(),
        notes: u.body.clone(),
    }
}

/// What the last check found and kept (the page asks once it is ready: the check at start may
/// end before it listens).
pub fn pending_info<R: Runtime>(app: &AppHandle<R>) -> Option<UpdateInfo> {
    let pending = app.try_state::<PendingUpdate>()?;
    let found = pending.0.lock().unwrap_or_else(|p| p.into_inner());
    found.as_ref().map(info_of)
}

/// Asks the release server whether a newer version exists (and keeps it for `install`).
pub async fn check<R: Runtime>(app: &AppHandle<R>) -> Result<Option<UpdateInfo>, AppError> {
    let updater = app
        .updater_builder()
        .on_before_exit(|| tracing::info!("update: Kayro quits for the installer"))
        .build()
        .map_err(failed)?;
    let found = updater.check().await.map_err(failed)?;
    let info = found.as_ref().map(info_of);
    tracing::info!(found = ?info.as_ref().map(|i| &i.version), "update: checked");
    if let Some(pending) = app.try_state::<PendingUpdate>() {
        *pending.0.lock().unwrap_or_else(|p| p.into_inner()) = found;
    }
    Ok(info)
}

/// Downloads the update found by `check`, verifies its signature, installs it. `progress` gets
/// (bytes so far, total if known). On Windows Kayro quits during the install.
pub async fn install<R: Runtime>(
    app: &AppHandle<R>,
    mut progress: impl FnMut(u64, Option<u64>) + Send + 'static,
) -> Result<(), AppError> {
    let update = app
        .try_state::<PendingUpdate>()
        .and_then(|p| p.0.lock().unwrap_or_else(|p| p.into_inner()).take())
        .ok_or_else(|| AppError::new(ErrorCode::NotFound, "no update to install"))?;
    let mut done: u64 = 0;
    update
        .download_and_install(
            move |chunk, total| {
                done += chunk as u64;
                progress(done, total);
            },
            || tracing::info!("update: downloaded, signature checked"),
        )
        .await
        .map_err(failed)?;
    tracing::info!("update: installed");
    app.restart();
}

/// What the installer asked (`%APPDATA%/Kayro/install-choices.json`), applied once then removed.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct InstallChoices {
    update_auto: Option<bool>,
}

pub fn apply_install_choices(config: &ConfigState, data_dir: &Path) {
    let file = data_dir.join("install-choices.json");
    let Ok(text) = std::fs::read_to_string(&file) else {
        return;
    };
    let choices: InstallChoices = serde_json::from_str(&text).unwrap_or_default();
    if let Some(update_auto) = choices.update_auto {
        let patch = SettingsPatch {
            update_auto: Some(update_auto),
            ..Default::default()
        };
        if let Err(e) = config.set_settings(patch) {
            tracing::warn!(error = %e, "install choices: not applied");
        }
    }
    let _ = std::fs::remove_file(&file);
    tracing::info!(?choices, "install choices applied");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::paths::DataPaths;

    #[test]
    fn the_installers_choice_reaches_the_settings_once() {
        let dir = tempfile::tempdir().unwrap();
        let config = ConfigState::load(DataPaths::new(dir.path()));
        assert!(!config.settings().update_auto);
        std::fs::write(dir.path().join("install-choices.json"), r#"{"updateAuto":true}"#).unwrap();
        apply_install_choices(&config, dir.path());
        assert!(config.settings().update_auto);
        assert!(!dir.path().join("install-choices.json").exists());
        // A broken file changes nothing and is removed.
        std::fs::write(dir.path().join("install-choices.json"), "{oops").unwrap();
        apply_install_choices(&config, dir.path());
        assert!(config.settings().update_auto);
        assert!(!dir.path().join("install-choices.json").exists());
    }
}
