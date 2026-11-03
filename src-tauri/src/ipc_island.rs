//! IPC of Kysland's newer features (`ipc_desktop.rs` is full; the island's first commands stay
//! there).

use tauri::{AppHandle, Runtime};

/// « Cacher l'île » (2026-11-02): the island went into the top edge (`tucked`; `width`: its
/// width at rest, logical) or comes out by itself. False: it cannot stay in, the page brings it
/// out again.
#[tauri::command]
#[specta::specta]
pub fn island_tuck<R: Runtime>(app: AppHandle<R>, tucked: bool, width: f64) -> bool {
    crate::desktop::island::set_tucked(&app, tucked, width)
}

/// Kysland's music mode (2026-11-02): the page wants it (`enter`: the window grows in place,
/// answered with the stage when the island may go), has drawn its drop (`go`: the window covers
/// the screen), or the island is back home (`done`).
#[tauri::command]
#[specta::specta]
pub fn island_stage<R: Runtime>(
    app: AppHandle<R>,
    step: crate::desktop::island::IslandStageStep,
) -> Option<crate::desktop::island::IslandStage> {
    crate::desktop::island::stage::step(&app, step)
}

/// Music mode: where the page draws, as rectangles (x, y, width, height; logical pixels of the
/// stage): the window's region follows them.
#[tauri::command]
#[specta::specta]
pub fn island_stage_area<R: Runtime>(app: AppHandle<R>, rects: Vec<[f64; 4]>) {
    crate::desktop::island::stage::area(&app, rects);
}
