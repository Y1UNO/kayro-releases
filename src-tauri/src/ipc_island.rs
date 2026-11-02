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
