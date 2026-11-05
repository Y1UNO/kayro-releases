//! The speakers' echo taken out of the microphone (step 21, 2026-11-04): with music or a video
//! on the speakers, the microphone hears them too; WebRTC's AEC3 (the `aec3` crate, pure Rust)
//! knows what they play (WASAPI loopback, platform/mic.rs `Mic::speakers`) and subtracts it,
//! 10 ms at a time, at 16 kHz. Only while the speakers play: with nothing on them the microphone
//! goes to the ear untouched.

use std::collections::VecDeque;

use aec3::nodes::audio::AudioFormat;
use aec3::pipelines::linear::{self, LinearPipeline};

use super::engine::RATE;

const FRAME: usize = RATE as usize / 100;
/// The speakers' sound kept ahead of the microphone at most (their clocks drift apart).
const AHEAD: usize = RATE as usize / 2;
/// After this long without sound on the speakers, the canceller rests (and starts afresh).
const QUIET_AFTER: usize = RATE as usize * 2;

/// What the speakers play, kept in step with the microphone: as many samples as the microphone
/// gave, zeros while they play nothing (WASAPI's loopback then gives nothing at all).
#[derive(Default)]
pub struct Reference {
    queue: VecDeque<f32>,
}

impl Reference {
    pub fn push(&mut self, played: &[f32]) {
        self.queue.extend(played);
        let extra = self.queue.len().saturating_sub(AHEAD);
        self.queue.drain(..extra);
    }

    /// `n` samples for the `n` the microphone just gave.
    pub fn take(&mut self, n: usize, out: &mut Vec<f32>) {
        let have = n.min(self.queue.len());
        out.extend(self.queue.drain(..have));
        out.extend(std::iter::repeat_n(0.0, n - have));
    }
}

/// Which of AEC3's helpers run with it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Options {
    /// WebRTC's noise suppression after the echo (music that the echo leaves).
    pub noise: bool,
    /// Only the linear filter's output: the echo subtracted, nothing suppressed (the user's
    /// voice is never cut while the speakers play; a little echo may remain).
    pub linear: bool,
}

/// What the listening uses (measured on 2026-11-04: docs/ROADMAP.md › Voix).
pub const OPTIONS: Options = Options {
    noise: false,
    linear: true,
};

pub struct Echo {
    options: Options,
    pipeline: Option<LinearPipeline>,
    mic: Vec<f32>,
    played: Vec<f32>,
    /// Samples since the speakers last played something.
    quiet: usize,
}

fn pipeline(o: Options) -> Option<LinearPipeline> {
    let format = AudioFormat::ten_ms(RATE as u32, 1);
    linear::builder(format, format)
        .enable_noise_suppression(o.noise)
        .enable_gain_controller2(false)
        .enable_high_pass_filter(true)
        .export_linear_output(o.linear)
        .build()
        .map_err(|e| tracing::warn!(error = %e, "voice: the echo canceller did not start"))
        .ok()
}

impl Echo {
    pub fn new(options: Options) -> Self {
        Self {
            options,
            pipeline: None,
            mic: Vec::new(),
            played: Vec::new(),
            quiet: QUIET_AFTER,
        }
    }

    /// The microphone's samples with the speakers' echo taken out (`played`: as many samples,
    /// what the speakers played meanwhile). Whole 10 ms frames: a partial one waits.
    pub fn clean(&mut self, mic: &[f32], played: &[f32], out: &mut Vec<f32>) {
        if played.iter().any(|s| s.abs() > 1e-4) {
            self.quiet = 0;
        } else {
            self.quiet = self.quiet.saturating_add(played.len());
        }
        if self.quiet >= QUIET_AFTER {
            // Nothing on the speakers: untouched, and the canceller rests.
            out.extend_from_slice(&self.mic);
            out.extend_from_slice(mic);
            self.mic.clear();
            self.played.clear();
            self.pipeline = None;
            return;
        }
        if self.pipeline.is_none() {
            self.pipeline = pipeline(self.options);
        }
        self.mic.extend_from_slice(mic);
        self.played.extend_from_slice(played);
        let frames = self.mic.len().min(self.played.len()) / FRAME;
        let Some(p) = self.pipeline.as_mut() else {
            out.append(&mut self.mic);
            self.played.clear();
            return;
        };
        let mut cleaned = [0.0f32; FRAME];
        for f in 0..frames {
            let at = f * FRAME..(f + 1) * FRAME;
            let mut fed = p.handle_render_frame(&self.played[at.clone()]).is_ok()
                && p.process_capture_frame(&self.mic[at.clone()], &mut cleaned)
                    .unwrap_or(false);
            if self.options.linear {
                match p.try_pull_linear_output() {
                    Ok(Some(lin)) if lin.payload().samples().len() == FRAME => {
                        cleaned.copy_from_slice(lin.payload().samples());
                    }
                    _ => fed = false,
                }
            }
            out.extend_from_slice(if fed { &cleaned } else { &self.mic[at] });
        }
        self.mic.drain(..frames * FRAME);
        self.played.drain(..frames * FRAME);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(n: usize, hz: f32, gain: f32, from: usize) -> Vec<f32> {
        (from..from + n)
            .map(|i| gain * (i as f32 * hz * std::f32::consts::TAU / RATE as f32).sin())
            .collect()
    }

    fn energy(x: &[f32]) -> f32 {
        x.iter().map(|s| s * s).sum::<f32>() / x.len().max(1) as f32
    }

    #[test]
    fn the_reference_keeps_in_step_with_the_microphone() {
        let mut r = Reference::default();
        let mut out = Vec::new();
        r.take(4, &mut out);
        assert_eq!(out, [0.0; 4]);
        r.push(&[1.0, 2.0, 3.0]);
        out.clear();
        r.take(2, &mut out);
        r.take(2, &mut out);
        assert_eq!(out, [1.0, 2.0, 3.0, 0.0]);
        r.push(&vec![0.5; AHEAD * 2]);
        assert_eq!(r.queue.len(), AHEAD);
    }

    #[test]
    fn silent_speakers_leave_the_microphone_untouched() {
        let mut e = Echo::new(OPTIONS);
        let mic = tone(480, 300.0, 0.3, 0);
        let mut out = Vec::new();
        e.clean(&mic, &[0.0; 480], &mut out);
        assert_eq!(out, mic);
    }

    /// Broadband « music » (what AEC3 is made for): a fixed noise.
    fn noise(n: usize, seed: &mut u32) -> Vec<f32> {
        (0..n)
            .map(|_| {
                *seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                (*seed >> 8) as f32 / (1 << 24) as f32 - 0.5
            })
            .collect()
    }

    #[test]
    fn what_the_speakers_play_is_taken_out_of_the_microphone() {
        let mut e = Echo::new(OPTIONS);
        let (mut before, mut after) = (Vec::new(), Vec::new());
        // 5 s of music, heard by the microphone 20 ms late and quieter.
        let delay = RATE as usize / 50;
        let mut seed = 7;
        let music = noise(RATE as usize * 5 + delay, &mut seed);
        for chunk in 0..(5 * 100 / 3) {
            let from = chunk * 480 + delay;
            let played = &music[from..from + 480];
            let mic: Vec<f32> = music[from - delay..from - delay + 480]
                .iter()
                .map(|s| s * 0.5)
                .collect();
            let mut out = Vec::new();
            e.clean(&mic, played, &mut out);
            if chunk > 100 {
                before.extend_from_slice(&mic);
                after.extend_from_slice(&out);
            }
        }
        assert!(
            energy(&after) < energy(&before) / 10.0,
            "{} -> {}",
            energy(&before),
            energy(&after)
        );
    }

    /// Its cost: `cargo test -p hub --release echo_cost -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn echo_cost() {
        let mut e = Echo::new(OPTIONS);
        let mut seed = 3;
        let music = noise(RATE as usize * 20, &mut seed);
        let started = std::time::Instant::now();
        let mut out = Vec::new();
        for c in music.chunks(480) {
            let mic: Vec<f32> = c.iter().map(|s| s * 0.4).collect();
            e.clean(&mic, c, &mut out);
        }
        let ms = started.elapsed().as_secs_f32() * 1000.0;
        println!("20 s of sound in {ms:.0} ms: {:.1} % of a core", ms / 200.0);
    }
}
