//! Step 21, the voice: the default microphone (WASAPI, shared), read only while Kayro listens
//! (voice/listen.rs). The sound goes to the speech models at once: nothing is recorded, kept or
//! sent (but the calibration's sayings, on the user's demand: voice/calib.rs). What the speakers
//! play (`Mic::speakers`, WASAPI loopback) is the echo canceller's reference, and the music
//! mode's beat (platform/loopback.rs). And what is in front: a program in full screen (a game),
//! or the locked screen.

use windows::core::{HSTRING, PWSTR};
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Foundation::RECT;
use windows::Win32::Media::Audio::{
    eCapture, eConsole, eRender, EDataFlow, IAudioCaptureClient, IAudioClient, IMMDevice,
    IMMDeviceEnumerator, MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_LOOPBACK, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL, STGM_READ};
use windows::Win32::UI::Shell::{
    SHQueryUserNotificationState, QUNS_BUSY, QUNS_NOT_PRESENT, QUNS_PRESENTATION_MODE,
    QUNS_RUNNING_D3D_FULL_SCREEN,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId,
};

use super::island::{class_of, monitor_rect, SHELL_CLASSES};

/// The microphone being listened to. Make, read and drop it on one thread.
pub struct Mic {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    channels: usize,
    float: bool,
    pub rate: u32,
}

/// The microphone's buffer: 200 ms (read every 30 ms, more while a sentence is understood).
const MIC_BUFFER_MS: u32 = 200;

/// Milliseconds in WASAPI's 100 ns units.
fn hundred_ns(ms: u32) -> i64 {
    i64::from(ms) * 10_000
}

/// A microphone Windows knows: its id (kept in the settings) and the name it shows.
pub struct MicInfo {
    pub id: String,
    pub name: String,
}

/// A COM string Windows gave, read and freed.
fn take(p: PWSTR) -> String {
    // SAFETY: a string allocated by COM for the caller, read once then freed.
    unsafe {
        let s = p.to_string().unwrap_or_default();
        CoTaskMemFree(Some(p.0 as *const _));
        s
    }
}

fn info(device: &IMMDevice) -> Option<MicInfo> {
    // SAFETY: COM calls on a device this thread holds.
    unsafe {
        let id = take(device.GetId().ok()?);
        let store = device.OpenPropertyStore(STGM_READ).ok()?;
        let name = store.GetValue(&PKEY_Device_FriendlyName).ok()?;
        let name = take(PropVariantToStringAlloc(&name).ok()?);
        Some(MicInfo { id, name })
    }
}

/// The microphones plugged in and enabled (Réglages › Assistant vocal et IA › Micro).
pub fn microphones() -> Vec<MicInfo> {
    devices(eCapture)
}

/// The outputs (speakers, headphones) plugged in and enabled (« Enceintes à écouter »).
pub fn outputs() -> Vec<MicInfo> {
    devices(eRender)
}

fn devices(flow: EDataFlow) -> Vec<MicInfo> {
    super::media::mta();
    // SAFETY: COM calls on this thread's objects.
    unsafe {
        let devices: Option<IMMDeviceEnumerator> =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok();
        let Some(list) = devices.and_then(|d| d.EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE).ok())
        else {
            return Vec::new();
        };
        let n = list.GetCount().unwrap_or(0);
        (0..n)
            .filter_map(|i| list.Item(i).ok())
            .filter_map(|d| info(&d))
            .collect()
    }
}

/// The device `id` (empty, or gone: Windows' default one for `flow`).
///
/// SAFETY: COM calls on this thread's objects.
pub(crate) unsafe fn device(id: &str, flow: EDataFlow) -> Option<IMMDevice> {
    unsafe {
        let devices: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let chosen = if id.is_empty() {
            None
        } else {
            devices.GetDevice(&HSTRING::from(id)).ok()
        };
        match chosen {
            Some(d) => Some(d),
            None => devices.GetDefaultAudioEndpoint(flow, eConsole).ok(),
        }
    }
}

impl Mic {
    /// The microphone `id` (empty, or gone: Windows' default one), started; `None` without one
    /// (or when Windows refuses it: the microphone privacy setting).
    pub fn open(id: &str) -> Option<Self> {
        super::media::mta();
        // SAFETY: COM calls on this thread's objects; the mix format is freed once used.
        unsafe { Self::start(&device(id, eCapture)?, 0, MIC_BUFFER_MS) }
    }

    /// What the speakers `id` play (empty, or gone: Windows' default output; WASAPI loopback:
    /// nothing comes while nothing plays), with `buffer_ms` of room between two reads.
    pub fn speakers(id: &str, buffer_ms: u32) -> Option<Self> {
        super::media::mta();
        // SAFETY: as in `open`.
        unsafe {
            let device = device(id, eRender)?;
            Self::start(&device, AUDCLNT_STREAMFLAGS_LOOPBACK, buffer_ms)
        }
    }

    /// SAFETY: COM calls on this thread's objects; the mix format is freed once used.
    unsafe fn start(device: &IMMDevice, flags: u32, buffer_ms: u32) -> Option<Self> {
        unsafe {
            let client: IAudioClient = device.Activate(CLSCTX_ALL, None).ok()?;
            let format = client.GetMixFormat().ok()?;
            let (channels, rate, bits) = {
                let f = &*format;
                (f.nChannels as usize, f.nSamplesPerSec, f.wBitsPerSample)
            };
            let buffer = hundred_ns(buffer_ms);
            let ready = client.Initialize(AUDCLNT_SHAREMODE_SHARED, flags, buffer, 0, format, None);
            CoTaskMemFree(Some(format as *const _));
            ready.ok()?;
            let capture: IAudioCaptureClient = client.GetService().ok()?;
            client.Start().ok()?;
            Some(Self {
                client,
                capture,
                channels: channels.max(1),
                float: bits == 32,
                rate,
            })
        }
    }

    /// Appends what was heard since the last call, as mono samples (-1…1). `false`: the device
    /// stopped answering (unplugged, or taken by Windows): to open again.
    pub fn read(&self, out: &mut Vec<f32>) -> bool {
        self.read_frames(|frame| out.push(frame.iter().sum::<f32>() / frame.len() as f32))
    }

    /// Each frame heard since the last call (one sample per channel, -1…1; zeros while the
    /// device reports silence). `false`: the device stopped answering.
    pub fn read_frames(&self, mut each: impl FnMut(&[f32])) -> bool {
        let mut frame = vec![0.0f32; self.channels];
        // SAFETY: each buffer is read within its GetBuffer/ReleaseBuffer pair, as many frames
        // as WASAPI gave, in the format it was opened with.
        unsafe {
            loop {
                let Ok(packet) = self.capture.GetNextPacketSize() else {
                    return false;
                };
                if packet == 0 {
                    return true;
                }
                let mut data = std::ptr::null_mut();
                let (mut frames, mut flags) = (0u32, 0u32);
                if self
                    .capture
                    .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
                    .is_err()
                {
                    return false;
                }
                let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 || data.is_null();
                let at = |k: usize| {
                    if self.float {
                        *(data as *const f32).add(k)
                    } else {
                        f32::from(*(data as *const i16).add(k)) / 32768.0
                    }
                };
                for i in 0..frames as usize {
                    for (c, s) in frame.iter_mut().enumerate() {
                        *s = if silent {
                            0.0
                        } else {
                            at(i * self.channels + c)
                        };
                    }
                    each(&frame);
                }
                let _ = self.capture.ReleaseBuffer(frames);
            }
        }
    }
}

impl Drop for Mic {
    fn drop(&mut self) {
        // SAFETY: stops the stream started in `open`.
        let _ = unsafe { self.client.Stop() };
    }
}

/// What is in front of the user, for the voice's soft sleep.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Front {
    /// The screen is locked (or another user's session is shown).
    pub locked: bool,
    /// A program in full screen (a game, a film), not Kayro.
    pub full_screen: bool,
}

pub fn front(own: u32) -> Front {
    // SAFETY: a plain query; a failure reads as « nothing special ».
    let state = unsafe { SHQueryUserNotificationState() }.ok();
    let locked = state == Some(QUNS_NOT_PRESENT);
    // Windows' « a program in full screen runs » says nothing of which one: Kayro's own
    // immersive window counts there too. Only another program in front pauses the voice.
    let busy = matches!(
        state,
        Some(QUNS_BUSY | QUNS_RUNNING_D3D_FULL_SCREEN | QUNS_PRESENTATION_MODE)
    );
    let front = foreground_pid().filter(|&pid| pid != own);
    // A film in a browser or a player is no game: the voice stays (2026-11-05, the user's wish).
    let film = front
        .and_then(super::process::exe_name)
        .is_some_and(|exe| watching(&exe));
    Front {
        locked,
        full_screen: !locked && front.is_some() && !film && (busy || window_full_screen(own)),
    }
}

/// Browsers and video players: in full screen they show a film, not a game.
const WATCHING: [&str; 19] = [
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "opera.exe",
    "brave.exe",
    "vivaldi.exe",
    "comet.exe",
    "arc.exe",
    "zen.exe",
    "vlc.exe",
    "mpv.exe",
    "mpc-hc64.exe",
    "mpc-be64.exe",
    "potplayermini64.exe",
    "wmplayer.exe",
    "video.ui.exe",
    "microsoft.media.player.exe",
    "plex.exe",
    "stremio.exe",
];

fn watching(exe: &str) -> bool {
    let exe = exe.rsplit(['\\', '/']).next().unwrap_or(exe).to_ascii_lowercase();
    WATCHING.contains(&exe.as_str())
}

fn foreground_pid() -> Option<u32> {
    // SAFETY: read-only queries; a stale handle only makes them fail.
    unsafe {
        let window = GetForegroundWindow();
        if window.is_invalid() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(window, Some(&mut pid));
        (pid != 0).then_some(pid)
    }
}

/// The foreground window covers its whole screen, and is neither Kayro's nor the desktop's.
fn window_full_screen(own: u32) -> bool {
    // SAFETY: read-only queries; a stale handle only makes them fail.
    unsafe {
        let window = GetForegroundWindow();
        if window.is_invalid() {
            return false;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(window, Some(&mut pid));
        if pid == own || SHELL_CLASSES.contains(&class_of(window).as_str()) {
            return false;
        }
        let mut rect = RECT::default();
        if GetWindowRect(window, &mut rect).is_err() {
            return false;
        }
        monitor_rect(window).is_some_and(|m| {
            rect.left <= m.left
                && rect.top <= m.top
                && rect.right >= m.right
                && rect.bottom >= m.bottom
        })
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_film_in_a_browser_or_a_player_is_no_game() {
        assert!(super::watching("comet.exe"));
        assert!(super::watching(r"C:\Program Files\VideoLAN\VLC\vlc.exe"));
        assert!(super::watching("MSEdge.exe"));
        assert!(!super::watching("FH6.exe"));
        assert!(!super::watching("RobloxPlayerBeta.exe"));
    }
}
