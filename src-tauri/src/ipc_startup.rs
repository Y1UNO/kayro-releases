//! Réglages › Démarrage (step 19): the apps Windows starts at login, switched on and off like the
//! Task Manager does (crates/startup), and « Tout remettre comme avant » for what Kayro switched
//! off (at install or here). Registry work runs off the interface thread (async commands).

use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_autostart::ManagerExt;

use crate::config::ConfigState;
use crate::error::{AppError, ErrorCode};
use crate::platform::logon_task;
use kayro_startup::{Journal, Lock, Registry};

/// What Windows passes at login (lib.rs `SILENT_FLAG`).
const SILENT: &str = crate::SILENT_FLAG;

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

/// Whether Windows starts the hub at login: its logon task (2026-10-31), or the `Run` key an
/// older version wrote (moved to a task at the next start, `autostart_follow`).
#[tauri::command]
#[specta::specta]
pub async fn autostart_get<R: Runtime>(app: AppHandle<R>) -> Result<bool, AppError> {
    Ok(autostart_on(&app))
}

#[tauri::command]
#[specta::specta]
pub async fn autostart_set<R: Runtime>(app: AppHandle<R>, enabled: bool) -> Result<bool, AppError> {
    set_autostart(&app, enabled)
}

fn autostart_on<R: Runtime>(app: &AppHandle<R>) -> bool {
    let name = &app.package_info().name;
    logon_task::query(name).is_some() || crate::platform::startup::run_command(name).is_some()
}

/// Switches « Démarrer avec Windows » (the logon task), and removes what an older version left
/// in the `Run` key. Slow (the Task Scheduler): never on the interface thread.
pub fn set_autostart<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Result<bool, AppError> {
    // A development build never registers itself: its console window would open at login, and
    // an older build would put the user's newer settings aside (31/10 bug).
    if cfg!(debug_assertions) {
        tracing::info!(
            enabled,
            "start with Windows left alone by a development build"
        );
        return Ok(autostart_on(app));
    }
    let name = app.package_info().name.clone();
    let internal = |e: String| AppError::new(ErrorCode::Internal, e);
    if enabled {
        let exe = std::env::current_exe().map_err(|e| internal(e.to_string()))?;
        logon_task::create(&name, &exe, SILENT).map_err(internal)?;
    } else {
        logon_task::delete(&name).map_err(internal)?;
    }
    forget_run_entry(app);
    tracing::info!(enabled, "start with Windows changed");
    Ok(autostart_on(app))
}

/// The `Run` key's entry of an older version, and the « off » mark the Task Manager may have
/// left beside it: gone, the registry as before the first enable.
fn forget_run_entry<R: Runtime>(app: &AppHandle<R>) {
    let name = &app.package_info().name;
    if crate::platform::startup::run_command(name).is_some() {
        if let Err(e) = app.autolaunch().disable() {
            tracing::warn!(error = %e, "start with Windows: the old Run entry stays");
        }
    }
    crate::platform::startup::forget_startup_approval(name);
}

/// At start, off the interface thread: an older version's `Run` entry becomes the logon task,
/// and a task that starts another Kayro (an old build, another folder) points to this one.
/// Nothing when « start with Windows » is off, or in a development build.
pub fn autostart_follow<R: Runtime>(app: &AppHandle<R>) {
    if cfg!(debug_assertions) {
        return;
    }
    let name = &app.package_info().name;
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let legacy = crate::platform::startup::run_command(name);
    let follows = match logon_task::query(name) {
        Some(task) => logon_task::starts(&task, &exe),
        None if legacy.is_some() => false,
        None => return,
    };
    if follows && legacy.is_none() {
        return;
    }
    match set_autostart(app, true) {
        Ok(_) => tracing::info!(
            ?legacy,
            "start with Windows: the logon task starts this Kayro"
        ),
        Err(e) => tracing::warn!(error = %e, "start with Windows: could not point it back"),
    }
}
