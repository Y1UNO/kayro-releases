//! Typed IPC surface: every command and event the interface can use. `builder()` is shared by
//! the app and by `gen_types`, so the generated `src/ipc/bindings.ts` can never drift.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, State};
use tauri_specta::{collect_commands, collect_events, Builder, Event};

use crate::config::apps::{AppEntry, AppsFile, NewApp};
use crate::config::schema::{Settings, SettingsPatch};
use crate::config::ConfigState;
use crate::error::AppError;

/// Emitted after every successful change of the settings (also to the window that made it).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct SettingsChanged(pub Settings);

/// Emitted after every successful change of the app list.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct AppsChanged(pub AppsFile);

#[tauri::command]
#[specta::specta]
pub fn ping() -> String {
    "pong".into()
}

/// Called by the UI after its first paint: the window stays hidden until then (no white
/// flash), and stays hidden for good when started with `--silent`.
#[tauri::command]
#[specta::specta]
pub fn app_ready(app: AppHandle) -> Result<(), AppError> {
    if std::env::args().any(|a| a == crate::SILENT_FLAG) {
        tracing::info!("silent start: window stays hidden");
        return Ok(());
    }
    crate::show_and_focus(&app)
}

#[tauri::command]
#[specta::specta]
pub fn settings_get(state: State<'_, ConfigState>) -> Settings {
    state.settings()
}

#[tauri::command]
#[specta::specta]
pub fn settings_set<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    patch: SettingsPatch,
) -> Result<Settings, AppError> {
    let settings = state.set_settings(patch)?;
    notify(SettingsChanged(settings.clone()).emit(&app));
    Ok(settings)
}

#[tauri::command]
#[specta::specta]
pub fn apps_list(state: State<'_, ConfigState>) -> Vec<AppEntry> {
    state.apps().apps
}

#[tauri::command]
#[specta::specta]
pub fn apps_add<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    new_app: NewApp,
) -> Result<AppEntry, AppError> {
    let entry = state.add_app(new_app)?;
    notify(AppsChanged(state.apps()).emit(&app));
    Ok(entry)
}

#[tauri::command]
#[specta::specta]
pub fn apps_update<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    entry: AppEntry,
) -> Result<AppEntry, AppError> {
    let entry = state.update_app(entry)?;
    notify(AppsChanged(state.apps()).emit(&app));
    Ok(entry)
}

#[tauri::command]
#[specta::specta]
pub fn apps_remove<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
    id: String,
) -> Result<(), AppError> {
    state.remove_app(&id)?;
    notify(AppsChanged(state.apps()).emit(&app));
    Ok(())
}

/// A failed notification never fails the command: the change is already saved.
fn notify(result: tauri::Result<()>) {
    if let Err(e) = result {
        tracing::warn!(error = %e, "could not emit an event");
    }
}

pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            ping,
            app_ready,
            settings_get,
            settings_set::<tauri::Wry>,
            apps_list,
            apps_add::<tauri::Wry>,
            apps_update::<tauri::Wry>,
            apps_remove::<tauri::Wry>,
        ])
        .events(collect_events![SettingsChanged, AppsChanged])
}

#[cfg(test)]
mod tests {
    use super::*;
    use specta_typescript::Typescript;
    use std::path::PathBuf;

    fn committed_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/ipc/bindings.ts")
    }

    /// `src/ipc/bindings.ts` must be exactly what the Rust types generate (`npm run gen:types`).
    #[test]
    fn committed_bindings_match_the_rust_types() {
        let dir = tempfile::tempdir().unwrap();
        let fresh = dir.path().join("bindings.ts");
        builder()
            .export(Typescript::default(), &fresh)
            .expect("export");
        let norm = |p: &PathBuf| {
            std::fs::read_to_string(p)
                .unwrap_or_default()
                .replace("\r\n", "\n")
        };
        assert!(
            norm(&fresh) == norm(&committed_path()),
            "src/ipc/bindings.ts is out of date: run `npm run gen:types`"
        );
    }
}
