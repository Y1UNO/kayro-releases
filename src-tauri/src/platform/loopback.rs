//! Step 20 (Kysland): the sound the PC plays, read as it plays (WASAPI loopback of the default
//! output) so that the island's bars move in rhythm with the music. Only levels are computed from
//! it, at once (media/beat.rs): nothing is recorded, kept or sent, and it runs only while music
//! plays and the island shows. Not the microphone.

use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator,
    AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL};

/// The output being listened to. Make, read and drop it on one thread.
pub struct Capture {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    channels: usize,
    float: bool,
    pub rate: u32,
}

/// 20 ms of buffer, in 100 ns units.
const BUFFER: i64 = 200_000;

impl Capture {
    pub fn open() -> Option<Self> {
        super::media::mta();
        // SAFETY: COM calls on this thread's objects; the mix format is freed once used.
        unsafe {
            let devices: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
            let device = devices.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
            let client: IAudioClient = device.Activate(CLSCTX_ALL, None).ok()?;
            let format = client.GetMixFormat().ok()?;
            let (channels, rate, bits) = {
                let f = &*format;
                (f.nChannels as usize, f.nSamplesPerSec, f.wBitsPerSample)
            };
            let flags = AUDCLNT_STREAMFLAGS_LOOPBACK;
            let ready = client.Initialize(AUDCLNT_SHAREMODE_SHARED, flags, BUFFER, 0, format, None);
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

    /// Appends what was played since the last call, as mono samples (-1…1), and its sides
    /// (half the left minus the right; 0 for a mono output): what is in the middle of the stereo
    /// (a voice, mostly) cancels there (the music mode, 2026-11-03).
    pub fn read(&self, out: &mut Vec<f32>, side: &mut Vec<f32>) {
        // SAFETY: each buffer is read within its GetBuffer/ReleaseBuffer pair, as many frames
        // as WASAPI gave, in the format it was opened with.
        unsafe {
            while self.capture.GetNextPacketSize().unwrap_or(0) > 0 {
                let mut data = std::ptr::null_mut();
                let (mut frames, mut flags) = (0u32, 0u32);
                if self
                    .capture
                    .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
                    .is_err()
                {
                    break;
                }
                let n = frames as usize;
                let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 || data.is_null();
                let at = |k: usize| {
                    if self.float {
                        *(data as *const f32).add(k)
                    } else {
                        f32::from(*(data as *const i16).add(k)) / 32768.0
                    }
                };
                for i in 0..n {
                    let (mut sum, mut diff) = (0.0f32, 0.0f32);
                    if !silent {
                        let first = i * self.channels;
                        for c in 0..self.channels {
                            sum += at(first + c);
                        }
                        if self.channels >= 2 {
                            diff = 0.5 * (at(first) - at(first + 1));
                        }
                    }
                    out.push(sum / self.channels as f32);
                    side.push(diff);
                }
                let _ = self.capture.ReleaseBuffer(frames);
            }
        }
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        // SAFETY: stops the stream started in `open`.
        let _ = unsafe { self.client.Stop() };
    }
}
