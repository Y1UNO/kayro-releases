//! IPC of the scene engine and of slots (registered in `ipc::builder`).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_specta::Event;

use crate::config::schema::{SceneFile, SlotsFile};
use crate::config::ConfigState;
use crate::error::AppError;
use crate::ipc::notify;
use crate::launcher::system::SystemLauncher;
use crate::procwatch::{ProcWatch, RunningApps};
use crate::scenes::action::Env;
use crate::scenes::clock::RealClock;
use crate::scenes::exec::execute;
use crate::scenes::{ProgressEvent, SceneRunner};

/// Progress of the scene being played: one event per step change, plus its start and end.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct SceneProgress(pub ProgressEvent);

#[tauri::command]
#[specta::specta]
pub fn scenes_list(state: State<'_, ConfigState>) -> Vec<SceneFile> {
    state.scenes()
}

#[tauri::command]
#[specta::specta]
pub fn scenes_save(state: State<'_, ConfigState>, scene: SceneFile) -> Result<SceneFile, AppError> {
    state.save_scene(scene)
}

#[tauri::command]
#[specta::specta]
pub fn slots_get(state: State<'_, ConfigState>) -> SlotsFile {
    state.slots()
}

/// Replaces all slots (slot name → app id).
#[tauri::command]
#[specta::specta]
pub fn slots_set(
    state: State<'_, ConfigState>,
    slots: BTreeMap<String, String>,
) -> Result<SlotsFile, AppError> {
    state.set_slots(slots)
}

/// `ProcWatch` is managed by Tauri, not shared: the scene thread reaches it through the handle.
struct TauriRunning<R: Runtime>(AppHandle<R>);

impl<R: Runtime> RunningApps for TauriRunning<R> {
    fn pids_of(&self, id: &str) -> Vec<u32> {
        self.0.state::<ProcWatch>().pids_of(id)
    }
    fn bring_to_front(&self, pids: &[u32]) -> bool {
        self.0.state::<ProcWatch>().bring_to_front(pids)
    }
    fn note_launch(&self) {
        self.0.state::<ProcWatch>().note_launch();
    }
    fn is_followed(&self, id: &str) -> bool {
        self.0.state::<ProcWatch>().is_followed(id)
    }
    fn close_softly(&self, pids: &[u32]) -> bool {
        self.0.state::<ProcWatch>().close_softly(pids)
    }
}

/// Starts a scene and returns its run id at once; progress arrives as `SceneProgress` events.
/// `close_confirmed` must be true only after the interface showed the user which apps `close`
/// steps will ask to close. One scene at a time (`busy` otherwise).
#[tauri::command]
#[specta::specta]
pub fn scene_run<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    runner: State<'_, SceneRunner>,
    id: String,
    close_confirmed: bool,
) -> Result<u32, AppError> {
    let scene = config
        .scene(&id)
        .ok_or_else(|| AppError::not_found(format!("scene «{id}»")))?;
    let (apps, slots) = (config.apps().apps, config.slots().slots);
    runner.start(move |run_id, cancel| {
        let (running, clock) = (TauriRunning(app.clone()), RealClock::new());
        let env = Env {
            launcher: &SystemLauncher,
            running: &running,
            clock: &clock,
            cancel,
            apps: &apps,
            slots: &slots,
            close_confirmed,
        };
        execute(&scene, run_id, &env, &|event| {
            notify(SceneProgress(event).emit(&app));
        });
    })
}

/// Cancels the scene being played (false when none is). Takes effect within milliseconds,
/// except while Windows is showing an administrator prompt for a `launch`.
#[tauri::command]
#[specta::specta]
pub fn scene_cancel(runner: State<'_, SceneRunner>) -> bool {
    runner.cancel()
}
