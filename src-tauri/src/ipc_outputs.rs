//! Step 21, the voice: the outputs (speakers) Windows has, for « Enceintes à écouter » (the one
//! whose sound the echo canceller takes out, voice/echo.rs).

use crate::ipc_voice::VoiceMicrophone;

/// The outputs plugged in and enabled (Réglages › Assistant vocal et IA).
#[tauri::command]
#[specta::specta]
pub async fn voice_outputs() -> Vec<VoiceMicrophone> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::platform::mic::outputs()
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
