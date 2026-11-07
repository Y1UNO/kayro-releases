//! The voice's models, downloaded on demand (Réglages › Assistant vocal et IA): the voice's only
//! network, never by itself, plain downloads (nothing is sent). Each file comes from Hugging Face
//! (Silero from sherpa-onnx's GitHub), is checked against its SHA-256 fingerprint as it arrives
//! (pinned here, 2026-11-04), and lands in `%APPDATA%/Kayro/voice/`. Removing a model deletes its
//! own files only.

use std::collections::HashSet;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use specta::Type;
use tauri::{AppHandle, Runtime};
use tauri_specta::Event;

use super::engine::voice_dir;

mod catalog;
pub use catalog::{File, Model, HF, MODELS};

/// A model as Réglages shows it (its texts are in the page's catalogue).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VoiceModelInfo {
    pub id: String,
    pub size_mb: u32,
    pub installed: bool,
    pub downloading: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DownloadStep {
    Downloading,
    Done,
    Failed,
    Cancelled,
}

/// A download's progress, about ten times a second.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct VoiceModelProgress {
    pub id: String,
    pub step: DownloadStep,
    /// 0–1.
    pub fraction: f32,
    pub done_mb: u32,
}

static BUSY: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(Default::default);
static CANCEL: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(Default::default);

fn set(of: &Mutex<HashSet<String>>) -> std::sync::MutexGuard<'_, HashSet<String>> {
    of.lock().unwrap_or_else(|p| p.into_inner())
}

pub fn find(id: &str) -> Option<&'static Model> {
    MODELS.iter().find(|m| m.id == id)
}

fn path(model: &Model, file: &File) -> PathBuf {
    voice_dir().join(model.dir).join(file.name)
}

/// Every file there, at its size (each was checked against its fingerprint when it came).
pub fn installed(model: &Model) -> bool {
    let files = model
        .files
        .iter()
        .all(|f| std::fs::metadata(path(model, f)).is_ok_and(|m| m.len() == f.size));
    // The brain's runtime is unpacked too.
    files && (model.id != "brain" || super::brain::installed(&voice_dir().join(model.dir)))
}

/// The brain's runtime, unpacked beside its archive (checked by its fingerprint as it came).
fn unpack(model: &Model) -> Result<(), String> {
    let dir = voice_dir().join(model.dir);
    for file in model.files.iter().filter(|f| f.name.ends_with(".zip")) {
        let into = dir.join(super::brain::RUNTIME_DIR);
        if into.join("llama-server.exe").is_file() {
            continue;
        }
        let zip = std::fs::File::open(dir.join(file.name)).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(zip).map_err(|e| e.to_string())?;
        archive.extract(&into).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn list() -> Vec<VoiceModelInfo> {
    let busy = set(&BUSY);
    MODELS
        .iter()
        .map(|m| VoiceModelInfo {
            id: m.id.into(),
            // Never « 0 Mo » for a small one (Silero: 0.6 MB).
            size_mb: m
                .files
                .iter()
                .map(|f| f.size)
                .sum::<u64>()
                .div_ceil(1_000_000) as u32,
            installed: installed(m),
            downloading: busy.contains(m.id),
        })
        .collect()
}

pub fn cancel(id: &str) {
    if set(&BUSY).contains(id) {
        set(&CANCEL).insert(id.to_string());
    }
}

fn emit<R: Runtime>(app: &AppHandle<R>, id: &str, step: DownloadStep, done: u64, total: u64) {
    let progress = VoiceModelProgress {
        id: id.into(),
        step,
        fraction: if total == 0 {
            1.0
        } else {
            done as f32 / total as f32
        },
        done_mb: (done / 1_000_000) as u32,
    };
    crate::ipc::notify(progress.emit(app));
}

/// Downloads what is missing of a model, file by file (`.part` until its fingerprint is right).
pub async fn download<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<(), String> {
    let model = find(id).ok_or("unknown model")?;
    let dir = voice_dir().join(model.dir);
    let result = download_files(app, id, &dir, model.files, || unpack(model)).await;
    super::models_changed(app);
    result
}

/// Is `id` being downloaded?
pub fn busy(id: &str) -> bool {
    set(&BUSY).contains(id)
}

/// Downloads `files` into `dir` under the name `id` (its progress: `VoiceModelProgress`), then
/// `after` (an archive to unpack). Also the hands' models (step 22), with their own folder.
pub async fn download_files<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    dir: &Path,
    files: &'static [File],
    after: impl FnOnce() -> Result<(), String> + Send,
) -> Result<(), String> {
    if !set(&BUSY).insert(id.to_string()) {
        return Err("already downloading".into());
    }
    set(&CANCEL).remove(id);
    let result = match fetch(app, id, dir, files).await {
        Ok(()) => after(),
        Err(e) => Err(e),
    };
    set(&BUSY).remove(id);
    let cancelled = set(&CANCEL).remove(id);
    let total: u64 = files.iter().map(|f| f.size).sum();
    match &result {
        Ok(()) => emit(app, id, DownloadStep::Done, total, total),
        Err(_) if cancelled => emit(app, id, DownloadStep::Cancelled, 0, total),
        Err(e) => {
            tracing::warn!(model = id, error = %e, "model download failed");
            emit(app, id, DownloadStep::Failed, 0, total);
        }
    }
    result
}

async fn fetch<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    dir: &Path,
    files: &[File],
) -> Result<(), String> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    let client = reqwest::Client::builder()
        .user_agent(concat!("Kayro/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let total: u64 = files.iter().map(|f| f.size).sum();
    let mut done = 0u64;
    let mut sent_at = Instant::now();
    tracing::info!(
        model = id,
        from = HF,
        "downloading a model (asked in Réglages)"
    );
    for file in files {
        let target = dir.join(file.name);
        if std::fs::metadata(&target).is_ok_and(|m| m.len() == file.size) {
            done += file.size;
            continue;
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let part = target.with_file_name(format!("{}.part", file.name));
        let outcome: Result<(), String> = async {
            let mut response = client
                .get(file.url)
                .send()
                .await
                .and_then(reqwest::Response::error_for_status)
                .map_err(|e| e.to_string())?;
            let mut out = std::fs::File::create(&part).map_err(|e| e.to_string())?;
            let mut hash = Sha256::new();
            while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
                if set(&CANCEL).contains(id) {
                    return Err("cancelled".into());
                }
                out.write_all(&chunk).map_err(|e| e.to_string())?;
                hash.update(&chunk);
                done += chunk.len() as u64;
                if sent_at.elapsed() >= Duration::from_millis(100) {
                    sent_at = Instant::now();
                    emit(app, id, DownloadStep::Downloading, done, total);
                }
            }
            out.flush().map_err(|e| e.to_string())?;
            drop(out);
            if format!("{:x}", hash.finalize()) != file.sha256 {
                return Err(format!("wrong fingerprint: {}", file.name));
            }
            std::fs::rename(&part, &target).map_err(|e| e.to_string())
        }
        .await;
        if outcome.is_err() {
            let _ = std::fs::remove_file(&part);
        }
        outcome?;
    }
    Ok(())
}

/// Deletes a model's files (its folder when it is left empty). Refused while being downloaded.
pub fn remove(id: &str) -> Result<(), String> {
    let model = find(id).ok_or("unknown model")?;
    if set(&BUSY).contains(id) {
        return Err("being downloaded".into());
    }
    for file in model.files {
        let p = path(model, file);
        if p.exists() {
            std::fs::remove_file(&p).map_err(|e| e.to_string())?;
        }
    }
    if model.id == "brain" {
        let unpacked = voice_dir().join(model.dir).join(super::brain::RUNTIME_DIR);
        if unpacked.exists() {
            std::fs::remove_dir_all(&unpacked).map_err(|e| e.to_string())?;
        }
    }
    if !model.dir.is_empty() {
        // The pieces' vocabulary Kayro wrote beside Parakeet's tokens (engine.rs), then the folder.
        let _ = std::fs::remove_file(voice_dir().join(model.dir).join("bpe.vocab"));
        let _ = std::fs::remove_dir(voice_dir().join(model.dir));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_model_file_is_pinned_and_comes_from_a_known_host() {
        for m in MODELS {
            for f in m.files {
                assert_eq!(f.sha256.len(), 64, "{}", f.name);
                assert!(
                    f.sha256.bytes().all(|b| b.is_ascii_hexdigit()),
                    "{}",
                    f.name
                );
                assert!(
                    f.url.starts_with("https://huggingface.co/")
                        || f.url.starts_with("https://github.com/k2-fsa/sherpa-onnx/")
                        || f.url.starts_with("https://github.com/ggml-org/llama.cpp/"),
                    "{}",
                    f.url
                );
                assert!(f.url.ends_with(f.name), "{}", f.url);
                // A moving branch breaks every install the day its repository is published again
                // (Parakeet, 2026-11-07): Hugging Face files are read at a fixed commit.
                if f.url.starts_with("https://huggingface.co/") {
                    let rev = f
                        .url
                        .split("/resolve/")
                        .nth(1)
                        .and_then(|r| r.split('/').next());
                    assert!(
                        rev.is_some_and(
                            |r| r.len() == 40 && r.bytes().all(|b| b.is_ascii_hexdigit())
                        ),
                        "not pinned to a commit: {}",
                        f.url
                    );
                }
            }
        }
        let ids: Vec<&str> = MODELS.iter().map(|m| m.id).collect();
        assert_eq!(
            ids,
            ["silero", "speaker", "wake", "parakeet", "canary", "brain"]
        );
    }
}
