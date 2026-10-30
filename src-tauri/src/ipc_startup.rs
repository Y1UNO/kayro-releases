//! Réglages › Démarrage (step 19): the apps Windows starts at login, switched on and off like the
//! Task Manager does (crates/startup), and « Tout remettre comme avant » for what Kayro switched
//! off (at install or here). Registry work runs off the interface thread (async commands).

use serde::Serialize;
use specta::Type;
use tauri::State;

use crate::config::ConfigState;
use crate::error::{AppError, ErrorCode};
use kayro_startup::{Journal, Lock, Registry};

/// Why an app cannot be changed here.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum StartupLock {
    /// For the whole PC (often drivers): needs administrator rights.
    Machine,
    /// Part of Windows.
    System,
    /// Kayro itself: its own switch is « Démarrer avec Windows ».
    Kayro,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StartupApp {
    pub id: String,
    pub name: String,
    pub target: String,
    pub enabled: bool,
    pub locked: Option<StartupLock>,
    /// Switched off by Kayro: « Tout remettre comme avant » puts it back.
    pub by_kayro: bool,
}

fn from_entry(e: kayro_startup::Entry) -> StartupApp {
    StartupApp {
        locked: e.locked.map(|l| match l {
            Lock::Machine => StartupLock::Machine,
            Lock::System => StartupLock::System,
            Lock::Kayro => StartupLock::Kayro,
        }),
        id: e.id,
        name: e.name,
        target: e.target,
        enabled: e.enabled,
        by_kayro: e.by_kayro,
    }
}

fn list(journal: &Journal) -> Vec<StartupApp> {
    kayro_startup::list(&Registry, journal)
        .into_iter()
        .map(from_entry)
        .collect()
}

fn io_error(e: std::io::Error) -> AppError {
    tracing::warn!(error = %e, "startup apps: change refused");
    AppError::new(ErrorCode::Io, e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn startup_apps(config: State<'_, ConfigState>) -> Result<Vec<StartupApp>, AppError> {
    Ok(list(&Journal::load(config.paths().root())))
}

#[tauri::command]
#[specta::specta]
pub async fn startup_app_set(
    config: State<'_, ConfigState>,
    id: String,
    enabled: bool,
) -> Result<Vec<StartupApp>, AppError> {
    let mut journal = Journal::load(config.paths().root());
    kayro_startup::set_enabled(&mut Registry, &mut journal, &id, enabled).map_err(io_error)?;
    tracing::info!(%id, enabled, "startup app changed");
    Ok(list(&journal))
}

#[tauri::command]
#[specta::specta]
pub async fn startup_apps_restore(
    config: State<'_, ConfigState>,
) -> Result<Vec<StartupApp>, AppError> {
    let mut journal = Journal::load(config.paths().root());
    let n = kayro_startup::restore_all(&mut Registry, &mut journal).map_err(io_error)?;
    tracing::info!(n, "startup apps put back");
    Ok(list(&journal))
}
