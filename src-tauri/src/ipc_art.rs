//! IPC of the local art (step 14): the index of every app's images, and the images the user gives
//! an app. The images themselves go through the `kayro-art` protocol, never through IPC.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, State};
use tauri_specta::Event;

use std::sync::Mutex;

use tauri::Manager;

use crate::art::palettes::{refresh, AppPalette};
use crate::art::user::{self, UserArtError};
use crate::art::{index, AppArt, ArtRole, ArtState};
use crate::config::ConfigState;
use crate::error::{AppError, ErrorCode};
use crate::ipc::notify;

/// Emitted when the user's images change (the whole index: a few hundred bytes per app).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct ArtChanged(pub Vec<AppArt>);

/// Emitted when the palettes changed (an image was added, changed or removed).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct PalettesChanged(pub Vec<AppPalette>);

#[derive(Default)]
struct WorkerState {
    running: bool,
    again: bool,
    latest: Vec<AppPalette>,
}

/// Computes the palettes on one background thread: a request while it works makes it run once
/// more at the end, never two threads at a time.
#[derive(Default)]
pub struct PaletteWorker(Mutex<WorkerState>);

impl PaletteWorker {
    pub fn latest(&self) -> Vec<AppPalette> {
        self.0.lock().map(|s| s.latest.clone()).unwrap_or_default()
    }

    pub fn request<R: Runtime>(&self, app: &AppHandle<R>) {
        let Ok(mut state) = self.0.lock() else { return };
        if state.running {
            state.again = true;
            return;
        }
        state.running = true;
        drop(state);
        let app = app.clone();
        let spawned = std::thread::Builder::new()
            .name("palettes".into())
            .spawn(move || {
                crate::platform::background_thread();
                loop {
                    let palettes = run_once(&app);
                    let worker = app.state::<PaletteWorker>();
                    let Ok(mut state) = worker.0.lock() else {
                        return;
                    };
                    if let Some(p) = palettes {
                        state.latest = p;
                    }
                    if !std::mem::take(&mut state.again) {
                        state.running = false;
                        return;
                    }
                }
            });
        if let Err(e) = spawned {
            tracing::warn!(error = %e, "palette: could not start the worker");
            if let Ok(mut state) = self.0.lock() {
                state.running = false;
            }
        }
    }
}

/// One pass over every app; `Some` with the palettes (the event is sent when they changed).
fn run_once<R: Runtime>(app: &AppHandle<R>) -> Option<Vec<AppPalette>> {
    let config = app.try_state::<ConfigState>()?;
    let art = app.try_state::<ArtState>()?;
    let icons_dir = config.paths().icons_dir();
    let icon_png = |entry: &crate::config::apps::AppEntry| {
        crate::icons::icon_png(&icons_dir, entry, &|p| crate::platform::icon::shell_icon(p))
    };
    let apps = config.apps().apps;
    let r = refresh(&art.roots, &apps, &config.paths().palettes(), &icon_png);
    tracing::info!(
        apps = apps.len(),
        palettes = r.palettes.len(),
        computed = r.computed,
        failed = r.failed,
        ms = r.millis as u64,
        "palette: pass done"
    );
    if r.changed {
        notify(PalettesChanged(r.palettes.clone()).emit(app));
    }
    Some(r.palettes)
}

/// The palettes known so far (the first pass may still be running: `PalettesChanged` follows).
#[tauri::command]
#[specta::specta]
pub fn palettes_get(worker: State<'_, PaletteWorker>) -> Vec<AppPalette> {
    worker.latest()
}

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
    app.state::<PaletteWorker>().request(&app);
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
    app.state::<PaletteWorker>().request(&app);
    let fresh = fresh_index(&config, &art);
    notify(ArtChanged(fresh.clone()).emit(&app));
    Ok(fresh)
}
