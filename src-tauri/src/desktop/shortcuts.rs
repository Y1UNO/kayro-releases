//! Global shortcuts and scene triggers (shortcut, notification-area menu).

use std::time::Instant;

use tauri::{AppHandle, Manager, Runtime};
use tauri_specta::Event;

use super::hotkeys::{self, Action, HotkeyState};
use super::{bench_file, lock, show, toggle, tray, DesktopState, SceneHotkey};
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
        Action::Scene(scene_id) => trigger_scene(app, &scene_id),
    }
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
