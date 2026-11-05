//! Step 21, the voice: the PC's volume set to a level (« mets le son à 30 »), one app's own
//! volume (« baisse Discord », « coupe le son de Spotify »: its Windows audio session), and the
//! user's microphone muted or not. Core Audio, nothing else.

use windows::core::Interface;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eCapture, eRender, IAudioSessionControl2, IAudioSessionManager2, ISimpleAudioVolume,
};
use windows::Win32::System::Com::CLSCTX_ALL;

use super::mic::device;

/// What is done to one app's sound.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AppVolume {
    Louder,
    Quieter,
    Mute,
    Unmute,
}

/// One step of an app's own volume (0…1).
const STEP: f32 = 0.2;

/// The PC's volume to `percent` (0–100), on Windows' default output.
pub fn set_master(percent: u8) -> bool {
    super::media::mta();
    // SAFETY: COM calls on this thread's objects.
    unsafe {
        let Some(dev) = device("", eRender) else {
            return false;
        };
        let Ok(vol) = dev.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) else {
            return false;
        };
        let level = f32::from(percent.min(100)) / 100.0;
        vol.SetMasterVolumeLevelScalar(level, std::ptr::null())
            .is_ok()
    }
}

/// The microphone `id` (empty: Windows' default one) muted or not.
pub fn mute_microphone(id: &str, muted: bool) -> bool {
    super::media::mta();
    // SAFETY: COM calls on this thread's objects.
    unsafe {
        let Some(dev) = device(id, eCapture) else {
            return false;
        };
        let Ok(vol) = dev.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) else {
            return false;
        };
        vol.SetMute(muted, std::ptr::null()).is_ok()
    }
}

/// The audio sessions of `pids` (an app and its helper processes) made louder, quieter, muted
/// or unmuted. `false`: the app plays no sound right now (no session).
pub fn app_volume(pids: &[u32], what: AppVolume) -> bool {
    super::media::mta();
    // SAFETY: COM calls on this thread's objects.
    unsafe {
        let Some(dev) = device("", eRender) else {
            return false;
        };
        let Ok(manager) = dev.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) else {
            return false;
        };
        let Ok(list) = manager.GetSessionEnumerator() else {
            return false;
        };
        let mut done = false;
        for i in 0..list.GetCount().unwrap_or(0) {
            let Ok(session) = list.GetSession(i) else {
                continue;
            };
            let Ok(control) = session.cast::<IAudioSessionControl2>() else {
                continue;
            };
            if !control.GetProcessId().is_ok_and(|pid| pids.contains(&pid)) {
                continue;
            }
            let Ok(volume) = session.cast::<ISimpleAudioVolume>() else {
                continue;
            };
            let ok = match what {
                AppVolume::Louder | AppVolume::Quieter => {
                    let now = volume.GetMasterVolume().unwrap_or(1.0);
                    let next = if what == AppVolume::Louder {
                        (now + STEP).min(1.0)
                    } else {
                        (now - STEP).max(0.0)
                    };
                    volume.SetMasterVolume(next, std::ptr::null()).is_ok()
                }
                AppVolume::Mute => volume.SetMute(true, std::ptr::null()).is_ok(),
                AppVolume::Unmute => volume.SetMute(false, std::ptr::null()).is_ok(),
            };
            done |= ok;
        }
        done
    }
}
