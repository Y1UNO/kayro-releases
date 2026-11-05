//! Step 21, the voice: where it stands, and its models (downloaded on demand, removed on demand).

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime, State};

use crate::config::schema::{SettingsPatch, VoiceMode, VoiceSettings};
use crate::config::ConfigState;
use crate::error::{AppError, ErrorCode};
use crate::procwatch::{ProcWatch, RunningApps};
use crate::voice::calib::{self, CalibPrompt, CalibScore, CalibSummary};
use crate::voice::models::{self, VoiceModelInfo};
use crate::voice::{VoiceHeard, VoiceState, VoiceStatus};

/// Where the voice stands (the page asks once at load, then follows `VoiceStateChanged`).
#[tauri::command]
#[specta::specta]
pub fn voice_state() -> VoiceState {
    crate::voice::state()
}

/// The microphone button (and « Arrête d'écouter »): closed until pressed again.
#[tauri::command]
#[specta::specta]
pub fn voice_mute<R: Runtime>(app: AppHandle<R>, muted: bool) {
    crate::voice::set_muted(&app, muted);
}

/// A command that waited for the user while the page was loading.
#[tauri::command]
#[specta::specta]
pub fn voice_take_pending() -> Option<VoiceHeard> {
    crate::voice::take_pending()
}

/// « Ferme X », confirmed on screen: a gentle close (a close message to its window, never
/// forced). `false`: not running, or no window to ask.
#[tauri::command]
#[specta::specta]
pub async fn voice_close<R: Runtime>(
    app: AppHandle<R>,
    config: State<'_, ConfigState>,
    id: String,
) -> Result<bool, AppError> {
    if !config.apps().apps.iter().any(|a| a.id == id) {
        return Err(AppError::not_found(format!("app {id}")));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let watch = app.state::<ProcWatch>();
        let pids = watch.pids_of(&id);
        !pids.is_empty() && watch.close_softly(&pids)
    })
    .await
    .map_err(|e| AppError::new(ErrorCode::Internal, format!("close task failed: {e}")))
}

#[tauri::command]
#[specta::specta]
pub fn voice_models() -> Vec<VoiceModelInfo> {
    models::list()
}

/// Downloads a model (the user's click: the voice's only network). Progress: `VoiceModelProgress`.
#[tauri::command]
#[specta::specta]
pub async fn voice_model_download<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<(), AppError> {
    if models::find(&id).is_none() {
        return Err(AppError::not_found(format!("voice model {id}")));
    }
    models::download(&app, &id)
        .await
        .map_err(|e| AppError::new(ErrorCode::DownloadFailed, e))
}

#[tauri::command]
#[specta::specta]
pub fn voice_model_cancel(id: String) {
    models::cancel(&id);
}

/// Removes a model's files. One the voice needs turns the voice off first (the page asked the
/// user), then waits for its models to be let go (a few hundred ms).
#[tauri::command]
#[specta::specta]
pub async fn voice_model_remove<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), AppError> {
    if id == "brain" {
        // Its server holds the files: the voice lets it go first (the classic way answers).
        crate::voice::brain::hold_off(true);
        crate::voice::models_changed(&app);
        // Waited off Tauri's async threads (up to 5 s).
        let _ =
            tauri::async_runtime::spawn_blocking(|| wait_for(50, || !crate::voice::brain::alive()))
                .await;
        let removed = models::remove(&id).map_err(|e| AppError::new(ErrorCode::Io, e));
        crate::voice::brain::hold_off(false);
        crate::voice::models_changed(&app);
        return removed;
    }
    let voice = app.state::<ConfigState>().settings().voice;
    if crate::voice::in_use(&id, &voice) {
        let off = SettingsPatch {
            voice: Some(VoiceSettings {
                mode: VoiceMode::Off,
                ..voice
            }),
            ..Default::default()
        };
        crate::ipc::update_settings(&app, off)?;
        let _ = tauri::async_runtime::spawn_blocking(|| {
            wait_for(40, || crate::voice::state().status == VoiceStatus::Off)
        })
        .await;
    }
    models::remove(&id).map_err(|e| AppError::new(ErrorCode::Io, e))?;
    crate::voice::models_changed(&app);
    Ok(())
}

/// Waits until `done` (checked every 100 ms, `tries` times at most). On a blocking thread only.
fn wait_for(tries: u32, done: impl Fn() -> bool) {
    for _ in 0..tries {
        if done() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct VoiceMicrophone {
    pub id: String,
    pub name: String,
}

/// The microphones Windows has (Réglages: « Micro »).
#[tauri::command]
#[specta::specta]
pub async fn voice_microphones() -> Vec<VoiceMicrophone> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::platform::mic::microphones()
            .into_iter()
            .map(|m| VoiceMicrophone {
                id: m.id,
                name: m.name,
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

/// A choice made in a doubt: the words said now name that app or scene (« Kayro apprend de
/// vous », memory.rs); only one of the configuration.
#[tauri::command]
#[specta::specta]
pub fn voice_teach(config: State<'_, ConfigState>, said: String, scene: bool, id: String) {
    use crate::voice::command::Target;
    let known = if scene {
        config.scenes().iter().any(|s| s.id == id)
    } else {
        config.apps().apps.iter().any(|a| a.id == id)
    };
    if known && said.chars().count() <= 80 {
        let target = if scene {
            Target::Scene(id)
        } else {
            Target::App(id)
        };
        crate::voice::memory::reward(&said, &target, 2);
    }
}

/// How many ways of naming things Kayro learned from the user.
#[tauri::command]
#[specta::specta]
pub fn voice_memory() -> u32 {
    crate::voice::memory::count() as u32
}

/// « Oublier »: what Kayro learned of the user's ways of naming things.
#[tauri::command]
#[specta::specta]
pub fn voice_forget() {
    crate::voice::memory::forget();
}

/// The guided learning of the wake word starts or ends (`VoiceLearned` for each saying).
#[tauri::command]
#[specta::specta]
pub fn voice_learn(on: bool) {
    crate::voice::set_learning(on);
}

/// « Calibrer ma voix » opens (the voice listens and keeps what it is told to) or closes.
#[tauri::command]
#[specta::specta]
pub fn voice_calibrate<R: Runtime>(app: AppHandle<R>, on: bool) {
    crate::voice::calib::set_on(on);
    crate::voice::models_changed(&app);
}

/// What the next saying is (`None`: nothing is kept until the next prompt).
#[tauri::command]
#[specta::specta]
pub fn voice_calib_record(prompt: Option<CalibPrompt>) -> Result<(), AppError> {
    if prompt.as_ref().is_some_and(|p| !calib::prompt_ok(p)) {
        return Err(AppError::validation("prompt", "invalid calibration prompt"));
    }
    calib::set_prompt(prompt);
    Ok(())
}

/// Every recording through the whole always mode (≈ 0.5 s each, on the listening thread).
#[tauri::command]
#[specta::specta]
pub async fn voice_calib_evaluate<R: Runtime>(app: AppHandle<R>) -> Result<CalibScore, AppError> {
    let answer = calib::request();
    crate::voice::models_changed(&app);
    let result = tauri::async_runtime::spawn_blocking(move || {
        answer.recv_timeout(std::time::Duration::from_secs(900))
    })
    .await
    .map_err(|e| AppError::new(ErrorCode::Internal, format!("evaluation task failed: {e}")))?;
    // The thread goes back to what it did.
    crate::voice::models_changed(&app);
    match result {
        Ok(Ok(score)) => Ok(score),
        Ok(Err(missing)) => Err(AppError::not_found(missing)),
        Err(_) => {
            calib::take_job();
            Err(AppError::new(ErrorCode::Internal, "evaluation timed out"))
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn voice_calib_summary() -> CalibSummary {
    calib::summary()
}

/// « Supprimer mes enregistrements ».
#[tauri::command]
#[specta::specta]
pub fn voice_calib_clear() -> Result<(), AppError> {
    calib::clear().map_err(|e| AppError::new(ErrorCode::Io, e.to_string()))
}
