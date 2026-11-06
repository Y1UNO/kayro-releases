//! The microphone (or what the speakers play), brought to the models' 16 kHz (listen.rs reads it
//! every 30 ms). A device that stops answering (unplugged, taken away by Windows) is noticed, so
//! that the listening can open it again.

use sherpa_onnx::LinearResampler;

use super::engine::RATE;
use crate::platform::mic::Mic;

/// The speakers' loopback keeps this much (read every 30 ms, more while a sentence is judged).
const SPEAKERS_BUFFER_MS: u32 = 200;

pub struct Ear {
    mic: Mic,
    resampler: Option<LinearResampler>,
    raw: Vec<f32>,
    broken: bool,
}

impl Ear {
    /// The microphone `id` (empty: Windows' default one); `None` without one, or when Windows
    /// refuses it.
    pub fn open(microphone: &str) -> Option<Self> {
        Self::of(Mic::open(microphone)?)
    }

    /// What the speakers `id` play (empty: Windows' default output): the echo's reference, the
    /// calibration's « with music ».
    pub fn speakers(id: &str) -> Option<Self> {
        Self::of(Mic::speakers(id, SPEAKERS_BUFFER_MS)?)
    }

    fn of(mic: Mic) -> Option<Self> {
        let rate = mic.rate as i32;
        let resampler = if rate == RATE {
            None
        } else {
            Some(LinearResampler::create(rate, RATE)?)
        };
        Some(Self {
            mic,
            resampler,
            raw: Vec::new(),
            broken: false,
        })
    }

    /// Appends what was heard since the last call, at 16 kHz.
    pub fn hear(&mut self, out: &mut Vec<f32>) {
        self.raw.clear();
        if !self.mic.read(&mut self.raw) {
            self.broken = true;
        }
        match &self.resampler {
            Some(r) => out.extend(r.resample(&self.raw, false)),
            None => out.extend_from_slice(&self.raw),
        }
    }

    /// What was heard meanwhile, dropped (after a sentence was handled: not a new one).
    pub fn discard(&mut self) {
        self.raw.clear();
        if !self.mic.read(&mut self.raw) {
            self.broken = true;
        }
    }

    /// The device stopped answering: to open again.
    pub fn broken(&self) -> bool {
        self.broken
    }
}
