//! Kysland's music mode (2026-11-03): the beat grid, from the AI Beat This! (CPJKU, ISMIR 2024;
//! MIT; its small checkpoint and its log-mel front end as ONNX, run here by ONNX Runtime: local,
//! nothing is sent or kept). Measured on MUSDB18 against Kayro's own grid (from its kicks): 2.5
//! times fewer beats off the grid (docs/MODE-MUSIQUE.md). On its own thread: the last 10 s of the
//! sound (mono, 22.05 kHz) are read every 8 s (about 4 % of one core), and the beats and
//! downbeats found go to the page (`MusicBeats`), which keeps the grid running in between.
//! Without its files (`ai/` among the resources), or with the music mode's « Qualité » at Basse
//! (or Auto in Kayro's Éco), there is no grid: the kicks' tempo stays.

use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use ort::environment::Environment;
use ort::session::Session;
use ort::value::Tensor;
use tauri::{AppHandle, Runtime};
use tauri_specta::Event;

use super::MusicBeats;

const RATE: f32 = 22_050.0;
/// The sound read each time, and how often (s).
const WINDOW_S: f32 = 10.0;
const EVERY_S: f32 = 8.0;
/// Under this much sound, no grid yet (s).
const LEAST_S: f32 = 6.0;
/// The model's frames per second (hop of 441 samples at 22.05 kHz).
const FPS: f32 = 50.0;

/// ONNX Runtime, loaded once from Kayro's own `onnxruntime.dll` (never a system one).
fn environment(dir: &Path) -> Option<&'static Environment> {
    static ENV: OnceLock<Option<Environment>> = OnceLock::new();
    ENV.get_or_init(|| {
        let made = ort::init_from(dir.join("onnxruntime.dll"))
            .map_err(|e| e.to_string())
            .and_then(|b| b.with_name("kayro").build().map_err(|e| e.to_string()));
        match made {
            Ok(env) => Some(env),
            Err(e) => {
                tracing::warn!("island: no AI rhythm (ONNX Runtime: {e})");
                None
            }
        }
    })
    .as_ref()
}

struct Models {
    mel: Session,
    net: Session,
}

impl Models {
    fn load(dir: &Path) -> Option<Self> {
        let env = environment(dir)?;
        let open = |name: &str| -> Result<Session, String> {
            Session::builder(env)
                .and_then(|b| Ok(b.with_intra_threads(1)?.with_inter_threads(1)?))
                .and_then(|mut b| b.commit_from_file(dir.join(name)))
                .map_err(|e| format!("{name}: {e}"))
        };
        match (open("beat-this-logmel.onnx"), open("beat-this-small0.onnx")) {
            (Ok(mel), Ok(net)) => Some(Self { mel, net }),
            (Err(e), _) | (_, Err(e)) => {
                tracing::warn!("island: no AI rhythm ({e})");
                None
            }
        }
    }

    /// The beat and downbeat logits (50 per second) of `audio` (22.05 kHz mono).
    fn logits(&mut self, audio: Vec<f32>) -> Result<(Vec<f32>, Vec<f32>), ort::Error> {
        let n = audio.len();
        let spect = {
            let out = self
                .mel
                .run(ort::inputs![Tensor::from_array(([n], audio))?])?;
            let (shape, data) = out[0].try_extract_tensor::<f32>()?;
            (shape[0] as usize, data.to_vec())
        };
        let (frames, data) = spect;
        let out = self
            .net
            .run(ort::inputs![Tensor::from_array(([1, frames, 128], data))?])?;
        let beat = out[0].try_extract_tensor::<f32>()?.1.to_vec();
        let down = out[1].try_extract_tensor::<f32>()?.1.to_vec();
        Ok((beat, down))
    }
}

/// The beats and downbeats (s) of `mono` at `rate`, with the files in `dir` (examples/rhythm_probe
/// measures them; the thread does the same every 8 s).
pub fn beats_of(dir: &Path, mono: &[f32], rate: u32) -> Result<(Vec<f32>, Vec<f32>), String> {
    let mut models = Models::load(dir).ok_or("no model")?;
    let mut sound = Vec::new();
    Resample {
        step: f64::from(rate) / f64::from(RATE),
        at: 0.0,
        last: 0.0,
    }
    .push(mono, &mut sound);
    let (beat, down) = models.logits(sound).map_err(|e| e.to_string())?;
    let beats = peaks(&beat);
    let downs = snap(&peaks(&down), &beats);
    let s = |f: &usize| *f as f32 / FPS;
    Ok((beats.iter().map(s).collect(), downs.iter().map(s).collect()))
}

/// The frames whose logit is above 0 and the highest within ±3 frames, neighbours merged (Beat
/// This!'s minimal post-processing).
pub fn peaks(logits: &[f32]) -> Vec<usize> {
    let mut out: Vec<usize> = Vec::new();
    for i in 0..logits.len() {
        let (a, b) = (i.saturating_sub(3), (i + 4).min(logits.len()));
        let top = logits[a..b].iter().copied().fold(f32::MIN, f32::max);
        if logits[i] > 0.0 && logits[i] >= top && out.last().is_none_or(|&p| i > p + 1) {
            out.push(i);
        }
    }
    out
}

/// Each downbeat moved to the nearest beat.
pub fn snap(downbeats: &[usize], beats: &[usize]) -> Vec<usize> {
    let mut out: Vec<usize> = downbeats
        .iter()
        .filter_map(|&d| beats.iter().copied().min_by_key(|&b| b.abs_diff(d)))
        .collect();
    out.dedup();
    out
}

/// The sound for the grid, resampled to 22.05 kHz (linearly, as it was measured).
struct Resample {
    step: f64,
    at: f64,
    last: f32,
}

impl Resample {
    fn push(&mut self, input: &[f32], out: &mut Vec<f32>) {
        for &s in input {
            while self.at <= 1.0 {
                out.push(self.last + (s - self.last) * self.at as f32);
                self.at += self.step;
            }
            self.at -= 1.0;
            self.last = s;
        }
    }
}

/// The grid's thread, while the music mode listens. Dropped: the thread ends.
pub struct Rhythm {
    tx: Sender<Vec<f32>>,
}

impl Rhythm {
    /// Starts it for the sound at `rate`, its files in `dir`.
    pub fn start<R: Runtime>(app: &AppHandle<R>, dir: PathBuf, rate: u32) -> Option<Self> {
        if !dir.join("beat-this-small0.onnx").is_file() {
            tracing::info!("island: no AI rhythm (no model in {})", dir.display());
            return None;
        }
        let (tx, rx) = mpsc::channel();
        let app = app.clone();
        std::thread::Builder::new()
            .name("island-rhythm".into())
            .spawn(move || run(&app, &dir, rate, &rx))
            .ok()?;
        Some(Self { tx })
    }

    /// The next mono samples (at the capture's rate).
    pub fn push(&self, samples: &[f32]) {
        let _ = self.tx.send(samples.to_vec());
    }
}

fn run<R: Runtime>(app: &AppHandle<R>, dir: &Path, rate: u32, rx: &Receiver<Vec<f32>>) {
    let Some(mut models) = Models::load(dir) else {
        return;
    };
    tracing::info!("island: the AI rhythm listens");
    let mut resample = Resample {
        step: f64::from(rate) / f64::from(RATE),
        at: 0.0,
        last: 0.0,
    };
    let keep = (WINDOW_S * RATE) as usize;
    let mut sound: Vec<f32> = Vec::with_capacity(keep * 2);
    let mut since = 0usize;
    let mut seq = 0u32;
    loop {
        // Waits for sound; the sender dropped (the mode stopped): the end.
        match rx.recv_timeout(Duration::from_millis(500)) {
            Ok(chunk) => {
                let before = sound.len();
                resample.push(&chunk, &mut sound);
                since += sound.len() - before;
            }
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
        if sound.len() > keep {
            sound.drain(..sound.len() - keep);
        }
        if (since as f32) < EVERY_S * RATE || (sound.len() as f32) < LEAST_S * RATE {
            continue;
        }
        since = 0;
        let heard_at = Instant::now();
        let length = sound.len() as f32 / RATE;
        match models.logits(sound.clone()) {
            Ok((beat, down)) => {
                let beats = peaks(&beat);
                let downs = snap(&peaks(&down), &beats);
                // How long ago each was, at the moment it is sent (the analysis took its time).
                let late = heard_at.elapsed().as_secs_f32();
                let ago = |f: &usize| length - *f as f32 / FPS + late;
                seq = seq.wrapping_add(1);
                let event = MusicBeats {
                    beats: beats.iter().map(ago).collect(),
                    downbeats: downs.iter().map(ago).collect(),
                    seq,
                };
                crate::ipc::notify(event.emit(app));
            }
            Err(e) => {
                tracing::warn!("island: the AI rhythm failed ({e})");
                break;
            }
        }
        // What came while it ran is read before the next one.
        loop {
            match rx.try_recv() {
                Ok(chunk) => {
                    let before = sound.len();
                    resample.push(&chunk, &mut sound);
                    since += sound.len() - before;
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return,
            }
        }
    }
    tracing::info!("island: the AI rhythm stops");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn peaks_are_local_maxima_above_zero_and_downbeats_land_on_beats() {
        let mut l = vec![-1.0f32; 40];
        for (i, v) in [(5, 2.0), (6, 1.5), (15, 3.0), (25, 0.5), (35, -0.2)] {
            l[i] = v;
        }
        assert_eq!(peaks(&l), vec![5, 15, 25]);
        assert_eq!(snap(&[14, 27], &[5, 15, 25]), vec![15, 25]);
    }

    #[test]
    fn the_sound_is_resampled_to_22050() {
        let mut r = Resample {
            step: 48_000.0 / f64::from(RATE),
            at: 0.0,
            last: 0.0,
        };
        let mut out = Vec::new();
        r.push(&vec![0.5; 48_000], &mut out);
        assert!((out.len() as i64 - 22_050).abs() <= 1, "{}", out.len());
    }
}
