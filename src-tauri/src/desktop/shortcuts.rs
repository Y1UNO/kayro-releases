//! Global shortcuts and scene triggers (shortcut, notification-area menu).

use std::time::Instant;

use tauri::{AppHandle, Manager, Runtime};
use tauri_specta::Event;

use super::hotkeys::{self, Action, HotkeyState};
use super::windows::{self, MAIN, WIDGET};
use super::{bench_file, lock, show, toggle, tray, DesktopState, SceneHotkey, SearchSummon};
use crate::config::ConfigState;
use crate::scenes::SceneRunner;

/// A global shortcut was pressed.
pub fn on_hotkey<R: Runtime>(app: &AppHandle<R>, id: u32) {
    let Some(action) = app.state::<HotkeyState>().action_for(id) else {
        return;
    };
    if bench_file().is_some() {
        *lock(&app.state::<DesktopState>().pressed_at) = Some(Instant::now());
    }
    match action {
        Action::Toggle => toggle(app),
        Action::Search => summon_search(app),
        Action::Scene(scene_id) => trigger_scene(app, &scene_id),
    }
}

/// « Écrire dans Kysland » (2026-11-04): the island opens on its search. With Kayro on screen,
/// Kayro's own search opens instead; with no island on screen (turned off, or a program in full
/// screen in front), Kayro comes with its search open.
pub fn summon_search<R: Runtime>(app: &AppHandle<R>) {
    let target = if let Some(main) = windows::visible(app) {
        *lock(&app.state::<DesktopState>().shown_at) = Some(Instant::now());
        let _ = main.set_focus();
        MAIN
    } else if windows::get(app, WIDGET).is_some_and(|w| w.is_visible().unwrap_or(false)) {
        WIDGET
    } else {
        show(app);
        MAIN
    };
    crate::ipc::notify(SearchSummon.emit_to(app, target));
}

/// Starts a scene from a shortcut or the menu. A scene that closes apps needs the user's
/// confirmation, so the hub is shown and asks; any other scene just starts.
pub fn trigger_scene<R: Runtime>(app: &AppHandle<R>, scene_id: &str) {
    use crate::config::scene::Step;
    let config = app.state::<ConfigState>();
    let Some(scene) = config.scene(scene_id) else {
        return;
    };
    if scene.steps.iter().any(|s| matches!(s, Step::Close { .. })) {
        *lock(&app.state::<DesktopState>().pending_scene) = Some(scene_id.to_string());
        show(app);
        crate::ipc::notify(SceneHotkey(scene_id.to_string()).emit(app));
        return;
    }
    let runner = app.state::<SceneRunner>();
    if let Err(e) = crate::ipc_scenes::start_scene(app, &config, &runner, scene_id, false) {
        tracing::info!(scene = scene_id, error = %e, "scene not started from the shortcut");
    }
}

/// The scene waiting for a confirmation, if a shortcut asked for one.
pub fn take_pending_scene<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    lock(&app.state::<DesktopState>().pending_scene).take()
}

/// Scenes were saved, imported or deleted: their shortcuts and the menu follow.
pub fn scenes_changed<R: Runtime>(app: &AppHandle<R>) {
    hotkeys::sync_scenes(app);
    tray::rebuild_menu(app);
}
