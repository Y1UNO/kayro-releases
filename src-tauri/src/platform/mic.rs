//! What the speakers play (WASAPI loopback, shared), for the music mode's beat
//! (platform/loopback.rs). Read in memory and dropped at once: nothing is recorded, kept or sent.
//! (Step 21 also read the microphone here; the voice was removed on 2026-11-07.)

use windows::core::HSTRING;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDevice, IMMDeviceEnumerator,
    MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_LOOPBACK,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL};

/// A sound stream being read. Make, read and drop it on one thread.
pub struct Mic {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    channels: usize,
    float: bool,
    pub rate: u32,
}

/// Milliseconds in WASAPI's 100 ns units.
fn hundred_ns(ms: u32) -> i64 {
    i64::from(ms) * 10_000
}

/// The output `id` (empty, or gone: Windows' default one).
///
/// SAFETY: COM calls on this thread's objects.
unsafe fn device(id: &str) -> Option<IMMDevice> {
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
            None => devices.GetDefaultAudioEndpoint(eRender, eConsole).ok(),
        }
    }
}

impl Mic {
    /// What the speakers `id` play (empty, or gone: Windows' default output; WASAPI loopback:
    /// nothing comes while nothing plays), with `buffer_ms` of room between two reads.
    pub fn speakers(id: &str, buffer_ms: u32) -> Option<Self> {
        super::media::mta();
        // SAFETY: COM calls on this thread's objects; the mix format is freed once used.
        unsafe {
            let device = device(id)?;
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
        // SAFETY: stops the stream started in `speakers`.
        let _ = unsafe { self.client.Stop() };
    }
}
