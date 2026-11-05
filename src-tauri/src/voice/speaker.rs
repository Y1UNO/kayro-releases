//! « Seulement ma voix » (step 21, 2026-11-04): Kayro wakes only for the user's voice, not for
//! the TV, a video or a friend. The calibration's recordings (calib.rs) give the user's
//! voiceprint: their CAM++ embeddings (engine.rs `speaker`), and a threshold from how alike the
//! user's own sayings are (each against the others) and how far Windows' own voices stay
//! (calib/impostors.rs). A finished sentence is compared to it before it is understood (≈ 30 ms).
//! Kept in `%APPDATA%/Kayro/voice/me/` with the recordings, removed with them; nothing else is
//! kept.

use std::path::Path;

use serde::{Deserialize, Serialize};
use sherpa_onnx::SpeakerEmbeddingExtractor;

use super::calib::Ratio;
use super::engine::RATE;
use crate::config::atomic::write_atomic;

const FILE: &str = "voiceprint.json";
const SCHEMA: u32 = 2;
/// The threshold stays between these (measured on six voices: the closest two, both French
/// women's synthetic voices, scored 0.67; a voice against itself, 0.76 and up).
const LOWEST: f32 = 0.35;
const HIGHEST: f32 = 0.70;
/// Below the user's tenth-lowest own score by this much, when no impostor says otherwise.
const MARGIN: f32 = 0.10;
/// Above the closest impostor by this much at least, and under the user's tenth-lowest own
/// score by a little.
const ABOVE_IMPOSTOR: f32 = 0.03;
const UNDER_OWN: f32 = 0.02;

/// How a sentence is scored against the voiceprint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Method {
    /// Its cosine to the mean of the user's sayings.
    Mean,
    /// The mean of its three highest cosines to the user's sayings themselves.
    Top3,
}

/// What the calibration builds. Measured on 2026-11-04 against six synthetic voices: with the
/// mean, the user's « Dis Arya » threshold sat 0.01 above the closest one (0.359 / 0.349); with
/// the top three, 0.10 above (0.519 / 0.417), the user's own sayings recognized the same
/// (39/40, 40/40 on « Dis Yuna » with 0.21 of margin).
pub const METHOD: Method = Method::Top3;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Voiceprint {
    schema_version: u32,
    /// The model it was made with (another one's embeddings do not compare).
    model: String,
    print: Vec<f32>,
    /// Each clean saying's embedding (`Method::Top3`; empty with `Mean`).
    #[serde(default)]
    each: Vec<Vec<f32>>,
    #[serde(default = "mean")]
    method: Method,
    pub threshold: f32,
    pub sayings: u32,
    /// The closest impostor's score when it was made (none: no impostor was heard).
    #[serde(default)]
    pub impostor: Option<f32>,
}

fn mean() -> Method {
    Method::Mean
}

/// The embedding of a saying (`None`: too short to say).
pub fn embed(x: &SpeakerEmbeddingExtractor, samples: &[f32]) -> Option<Vec<f32>> {
    let s = x.create_stream()?;
    s.accept_waveform(RATE, samples);
    s.input_finished();
    if !x.is_ready(&s) {
        return None;
    }
    x.compute(&s)
}

pub fn cosine(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let na: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let nb: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    dot / (na * nb).max(1e-9)
}

/// The mean of unit vectors.
fn mean_of<'a>(list: impl Iterator<Item = &'a Vec<f32>>) -> Vec<f32> {
    let mut m: Vec<f32> = Vec::new();
    for v in list {
        if m.is_empty() {
            m = vec![0.0; v.len()];
        }
        let n = v.iter().map(|x| x * x).sum::<f32>().sqrt().max(1e-9);
        for (a, b) in m.iter_mut().zip(v) {
            *a += b / n;
        }
    }
    m
}

/// The mean of the three highest cosines of `e` to `sayings`.
fn top3(e: &[f32], sayings: &[Vec<f32>]) -> f32 {
    let mut all: Vec<f32> = sayings.iter().map(|s| cosine(e, s)).collect();
    all.sort_by(|a, b| b.total_cmp(a));
    let top = &all[..all.len().min(3)];
    top.iter().sum::<f32>() / top.len().max(1) as f32
}

/// How alike `e` is to the voiceprint (the method it was built with).
pub fn score(v: &Voiceprint, e: &[f32]) -> f32 {
    match v.method {
        Method::Top3 if !v.each.is_empty() => top3(e, &v.each),
        _ => cosine(e, &v.print),
    }
}

/// The voiceprint from the user's clean sayings, with `impostors` (other voices) kept out, and
/// how many of the user's own (clean ones each against the others, plus those over music) it
/// recognizes.
pub fn build(
    clean: &[Vec<f32>],
    noisy: &[Vec<f32>],
    impostors: &[Vec<f32>],
    method: Method,
) -> Option<(Voiceprint, Ratio)> {
    if clean.len() < 4 {
        return None;
    }
    let mut own: Vec<f32> = (0..clean.len())
        .map(|i| {
            let others: Vec<Vec<f32>> = clean
                .iter()
                .enumerate()
                .filter(|&(j, _)| j != i)
                .map(|(_, e)| e.clone())
                .collect();
            match method {
                Method::Mean => cosine(&clean[i], &mean_of(others.iter())),
                Method::Top3 => top3(&clean[i], &others),
            }
        })
        .collect();
    own.sort_by(f32::total_cmp);
    let low = own[own.len() / 10];
    let mut v = Voiceprint {
        schema_version: SCHEMA,
        model: super::engine::SPEAKER_FILE.into(),
        print: mean_of(clean.iter()),
        each: match method {
            Method::Mean => Vec::new(),
            Method::Top3 => clean.to_vec(),
        },
        method,
        threshold: 0.0,
        sayings: clean.len() as u32,
        impostor: None,
    };
    let closest = impostors
        .iter()
        .map(|e| score(&v, e))
        .fold(None, |top: Option<f32>, s| {
            Some(top.map_or(s, |t| t.max(s)))
        });
    let generous = low - MARGIN;
    let threshold = match closest {
        // Just above the closest impostor, as long as the user's own sayings stay in.
        Some(top) => (top + ABOVE_IMPOSTOR).max(generous).min(low - UNDER_OWN),
        None => generous,
    };
    v.threshold = threshold.clamp(LOWEST, HIGHEST);
    v.impostor = closest;
    let mut ratio = Ratio::default();
    for s in &own {
        ratio.add(*s >= v.threshold);
    }
    for e in noisy {
        ratio.add(score(&v, e) >= v.threshold);
    }
    Some((v, ratio))
}

/// Is this saying the user's (and how alike)?
pub fn is_me(x: &SpeakerEmbeddingExtractor, v: &Voiceprint, samples: &[f32]) -> (bool, f32) {
    match embed(x, samples) {
        Some(e) => {
            let s = score(v, &e);
            (s >= v.threshold, s)
        }
        // Too short to tell: not refused for that.
        None => (true, 0.0),
    }
}

pub fn load(dir: &Path) -> Option<Voiceprint> {
    let bytes = std::fs::read(dir.join(FILE)).ok()?;
    let v: Voiceprint = serde_json::from_slice(&bytes).ok()?;
    (v.model == super::engine::SPEAKER_FILE && !v.print.is_empty()).then_some(v)
}

pub fn store(dir: &Path, v: &Voiceprint) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    let bytes = serde_json::to_vec(v).map_err(std::io::Error::other)?;
    write_atomic(&dir.join(FILE), &bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn around(base: &[f32], wobble: f32, i: usize) -> Vec<f32> {
        base.iter()
            .enumerate()
            .map(|(k, b)| b + wobble * (((k * 7 + i * 13) % 11) as f32 / 11.0 - 0.5))
            .collect()
    }

    #[test]
    fn a_voiceprint_knows_its_voice_and_not_another() {
        let me: Vec<f32> = (0..16).map(|k| (k as f32).sin()).collect();
        let other: Vec<f32> = (0..16).map(|k| (k as f32 * 1.7).cos()).collect();
        let clean: Vec<Vec<f32>> = (0..8).map(|i| around(&me, 0.3, i)).collect();
        for method in [Method::Mean, Method::Top3] {
            let (v, ratio) = build(&clean, &[around(&me, 0.4, 9)], &[], method).unwrap();
            assert!(v.threshold >= LOWEST && v.threshold <= HIGHEST);
            assert_eq!(ratio, Ratio { right: 9, total: 9 });
            assert!(score(&v, &around(&me, 0.3, 20)) >= v.threshold);
            assert!(score(&v, &other) < v.threshold);
        }
    }

    #[test]
    fn an_impostor_raises_the_threshold_but_the_users_sayings_stay_in() {
        let me: Vec<f32> = (0..16).map(|k| (k as f32).sin()).collect();
        let clean: Vec<Vec<f32>> = (0..12).map(|i| around(&me, 0.3, i)).collect();
        let (alone, _) = build(&clean, &[], &[], Method::Mean).unwrap();
        // An impostor close to the user: the threshold goes just above it...
        let near = around(&me, 1.2, 3);
        let (with, ratio) = build(&clean, &[], std::slice::from_ref(&near), Method::Mean).unwrap();
        assert!(with.threshold >= alone.threshold, "{with:?}");
        assert_eq!(with.impostor, Some(score(&with, &near)));
        // ...never above the user's own sayings (their tenth-lowest, less a little).
        assert!(ratio.right >= ratio.total - 1, "{ratio:?}");
    }

    #[test]
    fn too_few_sayings_make_no_voiceprint() {
        assert!(build(&vec![vec![1.0, 0.0]; 3], &[], &[], Method::Mean).is_none());
    }

    #[test]
    fn a_voiceprint_is_kept_and_read_back_and_an_older_one_still_reads() {
        let dir = tempfile::tempdir().unwrap();
        let clean: Vec<Vec<f32>> = (0..6).map(|i| around(&[1.0, 0.5, -0.2], 0.1, i)).collect();
        let (v, _) = build(&clean, &[], &[], Method::Top3).unwrap();
        store(dir.path(), &v).unwrap();
        assert_eq!(load(dir.path()), Some(v));
        let old = format!(
            r#"{{"schemaVersion":1,"model":"{}","print":[1.0,0.5],"threshold":0.5,"sayings":4}}"#,
            super::super::engine::SPEAKER_FILE
        );
        std::fs::write(dir.path().join(FILE), old).unwrap();
        let v = load(dir.path()).unwrap();
        assert_eq!((v.method, v.impostor), (Method::Mean, None));
    }
}
