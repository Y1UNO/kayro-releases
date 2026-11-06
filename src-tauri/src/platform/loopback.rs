//! Step 20 (Kysland): the sound the PC plays, read as it plays (WASAPI loopback of the default
//! output, `Mic::speakers`) so that the island's bars move in rhythm with the music. Only levels
//! are computed from it, at once (media/beat.rs): nothing is recorded, kept or sent, and it runs
//! only while music plays and the island shows. Not the microphone.

use super::mic::Mic;

/// The output being listened to. Make, read and drop it on one thread.
pub struct Capture {
    mic: Mic,
    pub rate: u32,
}

/// 20 ms of buffer: read every frame.
const BUFFER_MS: u32 = 20;

impl Capture {
    pub fn open() -> Option<Self> {
        let mic = Mic::speakers("", BUFFER_MS)?;
        Some(Self {
            rate: mic.rate,
            mic,
        })
    }

    /// Appends what was played since the last call, as mono samples (-1…1), and its sides
    /// (half the left minus the right; 0 for a mono output): what is in the middle of the stereo
    /// (a voice, mostly) cancels there (the music mode, 2026-11-03).
    pub fn read(&self, out: &mut Vec<f32>, side: &mut Vec<f32>) {
        self.mic.read_frames(|frame| {
            let n = frame.len() as f32;
            out.push(frame.iter().sum::<f32>() / n);
            side.push(match frame {
                [left, right, ..] => 0.5 * (left - right),
                _ => 0.0,
            });
        });
    }
}
