//! Step 19b, the library made easier: the icon of an app the scan proposes (not in the library
//! yet), so that the « Ajouter des applications » list shows each app's own logo — same sources as
//! the cards: the Shell icon of the program or shortcut, Steam's small icon for a Steam game, off
//! the interface thread — and the apps put in a new order (the order of the cards).

use std::collections::HashSet;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, State};
use tauri_specta::Event;

use crate::art::{locate, ArtRole, ArtState};
use crate::config::apps::{AppSource, AppsFile};
use crate::config::ConfigState;
use crate::detect::scan::{run_scan, DetectState, ScanReport, SourceReport};
use crate::detect::{deep, default_sources, tidy, DetectedApp, ScanCtx, SourceKind};
use crate::error::{AppError, ErrorCode};
use crate::ipc::notify;
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
        // Step 19c: the logo the advanced scan found in the app's folder comes first.
        if let Some(logo) = &app.logo_path {
            let png = std::fs::read(logo).ok().and_then(|b| icons::decode_png(&b));
            if let Some(png) = png.and_then(|i| {
                icons::encode_png(&icons::shrink(&icons::trim(&i), icons::ICON_PX)).ok()
            }) {
                return Some(icons::png_data_url(&png));
            }
        }
        if let AppSource::Steam { app_id } = &app.source {
            let found = steam_cache.and_then(|c| locate::steam(&c, app_id, ArtRole::Icon))?;
            let bytes = std::fs::read(found.path).ok()?;
            return Some(icons::data_url("image/jpeg", &bytes));
        }
        let source = icons::icon_source_for(&app.launch, &app.source)?;
        icons::icon_png_from(&dir, &app.id, source, &|path| {
            platform::icon::shell_icon(path)
        })
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

/// Step 19c: where the advanced scan is (folders read, apps found; `logos`: looking for logos).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct DeepProgress {
    pub folders: u32,
    pub found: u32,
    pub logos: bool,
}

/// « Scan avancé » (step 19c), started by the user: the usual scan, then the program and game
/// folders of the PC's disks (apps the Start Menu does not list), then a sharper logo in every
/// app's folder. Read-only; progress as `DeepProgress`; `detect_cancel` stops it.
#[tauri::command]
#[specta::specta]
pub async fn detect_deep<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    detect: State<'_, DetectState>,
) -> Result<ScanReport, AppError> {
    let existing = config.apps().apps;
    let ignored = config.settings().ignored_detections;
    let token = detect.begin();
    let scan_token = token.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let started = Instant::now();
        let mut report = run_scan(&default_sources(), &existing, &scan_token, &|p| {
            notify(p.emit(&app));
        });
        let ctx = ScanCtx::new(scan_token.clone());
        let progress = |folders: u32, found: u32, logos: bool| {
            notify(
                DeepProgress {
                    folders,
                    found,
                    logos,
                }
                .emit(&app),
            );
        };
        let known: HashSet<String> = report
            .sources
            .iter()
            .flat_map(|s| s.apps.iter().filter_map(|a| a.install_dir.as_ref()))
            .map(|d| d.to_lowercase())
            .collect();
        let roots = deep::roots(&deep::fixed_disks());
        let mut found = deep::scan_roots(&roots, &known, &ctx, &|f, n| progress(f, n, false));
        for a in &mut found {
            a.already_added = existing.iter().any(|e| a.matches_entry(e));
        }
        let count = found.len() as u32;
        let mut done = 0u32;
        for a in report.sources.iter_mut().flat_map(|s| s.apps.iter_mut()) {
            if a.logo_path.is_none() && !ctx.cancelled() {
                if let Some(dir) = a.install_dir.clone() {
                    a.logo_path = deep::find_logo(std::path::Path::new(&dir), &ctx)
                        .map(|p| p.to_string_lossy().into_owned());
                    done += 1;
                    if done.is_multiple_of(10) {
                        progress(deep::MAX_FOLDERS, count, true);
                    }
                }
            }
        }
        report.sources.push(SourceReport {
            source: SourceKind::Deep,
            apps: found,
            skipped: ctx.skipped(),
            error: None,
            ms: u32::try_from(started.elapsed().as_millis()).unwrap_or(u32::MAX),
        });
        tidy::mark_launchers(&mut report.sources);
        tidy::mark_ignored(&mut report, &ignored);
        report.cancelled = scan_token.is_cancelled();
        tracing::info!(
            found = count,
            ms = started.elapsed().as_millis() as u64,
            "detect: advanced scan done"
        );
        report
    })
    .await;
    detect.finish(&token);
    result.map_err(|e| AppError::new(ErrorCode::Internal, format!("scan task failed: {e}")))
}
