//! « Calibrer ma voix » (step 21, 2026-11-04): the user's own voice, recorded on demand and kept
//! on the PC, as Kayro's test set. A guided screen says what to say (the wake word, the name
//! alone, commands with the user's own apps, sentences that must not wake it, with music
//! playing); each saying is kept as a 16 kHz WAV in `%APPDATA%/Kayro/voice/me/` with what it
//! should do. The whole always mode then replays them (`evaluate`) and gives a score. Nothing
//! leaves the PC; « Supprimer » in Réglages removes it all. While calibrating, no command runs.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Mutex};

use serde::{Deserialize, Serialize};
use specta::Type;

use super::engine::RATE;
use crate::config::atomic::write_atomic;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CalibKind {
    /// The wake word alone.
    Wake,
    /// Its name alone (« Yuna »).
    Name,
    /// The wake word and a command, at the user's pace.
    Command,
    /// The same, quickly, without a pause.
    Quick,
    /// A command with music playing from the speakers.
    Music,
    /// A sentence that must not wake Kayro (« Tu as une minute ? »).
    Trap,
    /// Free speech: must not wake Kayro either.
    Chat,
}

/// What to say next, and what it must do (`expect`: `key` of the intent, « wake » or « none »).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CalibPrompt {
    /// Its name among the recordings (a new saying of the same key replaces the old one).
    pub key: String,
    pub kind: CalibKind,
    pub text: String,
    pub expect: String,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct Ratio {
    pub right: u32,
    pub total: u32,
}

impl Ratio {
    pub(super) fn add(&mut self, right: bool) {
        self.total += 1;
        self.right += u32::from(right);
    }
}

/// One recording replayed: what the command model wrote, what came of it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CalibResult {
    pub key: String,
    pub kind: CalibKind,
    pub text: String,
    pub heard: String,
    /// The intent's `key`, « none » when nothing woke.
    pub got: String,
    pub woke: bool,
    pub right: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CalibScore {
    /// Every saying with the wake word in it that woke Kayro.
    pub wake: Ratio,
    /// The commands (at the user's pace and quick) that did what was said.
    pub commands: Ratio,
    /// The commands said over music.
    pub music: Ratio,
    /// The sentences without the wake word that left Kayro asleep.
    pub calm: Ratio,
    /// The sayings « Seulement ma voix » knows as the user's (with the voice model only).
    pub voice: Ratio,
    /// The command model's time per sentence (median).
    pub median_ms: u32,
    /// The wake word's learned spellings, with what this evaluation added (Réglages keeps them).
    pub learned: Vec<String>,
    pub results: Vec<CalibResult>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CalibSummary {
    /// The prompts already said (the guided screen goes on from the first one missing).
    pub keys: Vec<String>,
    pub count: u32,
    pub seconds: u32,
    /// The last evaluation.
    pub score: Option<CalibScore>,
    /// The user's voiceprint is made (« Seulement ma voix » can be turned on).
    pub voiceprint: bool,
}

/// A saying was kept (`ok`: written to disk).
#[derive(Debug, Clone, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct VoiceRecorded {
    pub key: String,
    pub ok: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    key: String,
    kind: CalibKind,
    text: String,
    expect: String,
    seconds: f32,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Manifest {
    schema_version: u32,
    entries: Vec<Entry>,
    /// The last score, read on its own: one of an older shape is dropped, never the recordings.
    score: Option<serde_json::Value>,
}

const SCHEMA: u32 = 1;
const MANIFEST: &str = "calibration.json";
/// At most this many recordings (≈ 5 s each: a few MB).
const MAX_ENTRIES: usize = 200;

pub fn dir() -> PathBuf {
    super::engine::voice_dir().join("me")
}

fn load(dir: &Path) -> Manifest {
    std::fs::read(dir.join(MANIFEST))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn store(dir: &Path, m: &Manifest) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    let bytes = serde_json::to_vec_pretty(m).map_err(std::io::Error::other)?;
    write_atomic(&dir.join(MANIFEST), &bytes)
}

/// A key names a file: lower-case letters, digits and dashes only.
pub fn prompt_ok(p: &CalibPrompt) -> bool {
    let key = !p.key.is_empty()
        && p.key.len() <= 40
        && p.key
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    key && p.text.chars().count() <= 200 && p.expect.len() <= 200
}

/// What the speakers played during a saying sits beside it (`<key>.ref.wav`).
pub fn reference_of(dir: &Path, key: &str) -> PathBuf {
    dir.join(format!("{key}.ref.wav"))
}

/// Keeps a saying under its prompt (a new one of the same key replaces it), with what the
/// speakers played meanwhile when they played something.
fn keep(dir: &Path, p: &CalibPrompt, audio: &[f32], played: &[f32]) -> std::io::Result<()> {
    let mut m = load(dir);
    m.entries.retain(|e| e.key != p.key);
    if m.entries.len() >= MAX_ENTRIES {
        return Err(std::io::Error::other("too many recordings"));
    }
    std::fs::create_dir_all(dir)?;
    write_atomic(
        &dir.join(format!("{}.wav", p.key)),
        &super::engine::wav(audio),
    )?;
    let reference = reference_of(dir, &p.key);
    if played.iter().any(|s| s.abs() > 1e-4) {
        write_atomic(&reference, &super::engine::wav(played))?;
    } else if reference.exists() {
        std::fs::remove_file(&reference)?;
    }
    m.schema_version = SCHEMA;
    m.entries.push(Entry {
        key: p.key.clone(),
        kind: p.kind,
        text: p.text.clone(),
        expect: p.expect.clone(),
        seconds: audio.len() as f32 / RATE as f32,
    });
    store(dir, &m)
}

pub fn summary() -> CalibSummary {
    let m = load(&dir());
    CalibSummary {
        keys: m.entries.iter().map(|e| e.key.clone()).collect(),
        count: m.entries.len() as u32,
        seconds: m.entries.iter().map(|e| e.seconds).sum::<f32>().round() as u32,
        score: m.score.and_then(|v| serde_json::from_value(v).ok()),
        voiceprint: super::speaker::load(&dir()).is_some(),
    }
}

/// « Supprimer mes enregistrements »: the folder and all in it.
pub fn clear() -> std::io::Result<()> {
    match std::fs::remove_dir_all(dir()) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e),
        _ => Ok(()),
    }
}

// --- While calibrating (the listening thread asks) -------------------------------------------

static ON: AtomicBool = AtomicBool::new(false);
static PROMPT: Mutex<Option<CalibPrompt>> = Mutex::new(None);
type Job = mpsc::Sender<Result<CalibScore, String>>;
static JOB: Mutex<Option<Job>> = Mutex::new(None);

/// The guided screen is open: the voice listens (whatever its mode), records, runs nothing.
pub fn set_on(on: bool) {
    ON.store(on, Ordering::SeqCst);
    if !on {
        set_prompt(None);
    }
}

pub fn on() -> bool {
    ON.load(Ordering::SeqCst)
}

/// Calibrating, or an evaluation waits: the listening thread needs the always mode's models.
pub fn active() -> bool {
    on() || JOB.lock().unwrap_or_else(|p| p.into_inner()).is_some()
}

pub fn set_prompt(p: Option<CalibPrompt>) {
    *PROMPT.lock().unwrap_or_else(|p| p.into_inner()) = p;
}

/// A saying ended: kept under the prompt shown, if one is (its key, and whether it was written).
pub fn save(audio: &[f32], played: &[f32]) -> Option<(String, bool)> {
    let p = PROMPT.lock().unwrap_or_else(|p| p.into_inner()).take()?;
    let ok = keep(&dir(), &p, audio, played);
    if let Err(e) = &ok {
        tracing::warn!(error = %e, "voice: a calibration saying was not kept");
    }
    Some((p.key, ok.is_ok()))
}

/// Asks the listening thread for an evaluation (it has the models); the answer comes here.
pub fn request() -> mpsc::Receiver<Result<CalibScore, String>> {
    let (tx, rx) = mpsc::channel();
    *JOB.lock().unwrap_or_else(|p| p.into_inner()) = Some(tx);
    rx
}

pub fn take_job() -> Option<Job> {
    JOB.lock().unwrap_or_else(|p| p.into_inner()).take()
}

mod eval;
mod impostors;
mod variants;
pub use eval::{evaluate, key, Ears, Lists};

#[cfg(test)]
#[path = "calib_tests.rs"]
mod tests;
#[cfg(test)]
#[path = "calib_user_tests.rs"]
pub(crate) mod user_tests;
