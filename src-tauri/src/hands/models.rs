//! The hands' two models (MediaPipe Hands, as converted by OpenCV's model zoo, 2023-02,
//! Apache-2.0), downloaded on demand from Hugging Face (Réglages › Mains: the hands' only
//! network, plain downloads, nothing sent), each checked against its SHA-256 fingerprint as it
//! arrives (pinned on 2026-11-05, from a fixed commit of each repository), into
//! `%APPDATA%/Kayro/hands/`. The download itself is the voice's (voice/models.rs).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime};

use crate::voice::models::File;

pub const PALM: &str = "palm_detection_mediapipe_2023feb.onnx";
pub const MARK: &str = "handpose_estimation_mediapipe_2023feb.onnx";
/// Its progress comes as `VoiceModelProgress` with this id.
pub const ID: &str = "hands";

pub const FILES: &[File] = &[
    File {
        name: PALM,
        url: concat!(
            "https://huggingface.co/opencv/palm_detection_mediapipe/resolve/",
            "233e619dcea1759bf6de707b9b904fe30881ea55/palm_detection_mediapipe_2023feb.onnx"
        ),
        sha256: "78ff51c38496b7fc8b8ebdb6cc8c1abb02fa6c38427c6848254cdaba57fcce7c",
        size: 3_905_734,
    },
    File {
        name: MARK,
        url: concat!(
            "https://huggingface.co/opencv/handpose_estimation_mediapipe/resolve/",
            "4b2a0b446e5cf2f11fb6b2c7251091c035d2c1f7/handpose_estimation_mediapipe_2023feb.onnx"
        ),
        sha256: "db0898ae717b76b075d9bf563af315b29562e11f8df5027a1ef07b02bef6d81c",
        size: 4_099_621,
    },
];

pub fn dir() -> PathBuf {
    crate::paths::data_dir().join("hands")
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HandsModelInfo {
    pub size_mb: u32,
    pub installed: bool,
    pub downloading: bool,
}

pub fn installed() -> bool {
    FILES
        .iter()
        .all(|f| std::fs::metadata(dir().join(f.name)).is_ok_and(|m| m.len() == f.size))
}

pub fn info() -> HandsModelInfo {
    HandsModelInfo {
        size_mb: FILES
            .iter()
            .map(|f| f.size)
            .sum::<u64>()
            .div_ceil(1_000_000) as u32,
        installed: installed(),
        downloading: crate::voice::models::busy(ID),
    }
}

pub async fn download<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let result = crate::voice::models::download_files(app, ID, &dir(), FILES, || Ok(())).await;
    super::models_changed(app);
    result
}

pub fn cancel() {
    crate::voice::models::cancel(ID);
}

/// Deletes the two files and the folder (refused while being downloaded). The camera is turned
/// off first by the caller.
pub fn remove() -> Result<(), String> {
    if crate::voice::models::busy(ID) {
        return Err("being downloaded".into());
    }
    for f in FILES {
        let p = dir().join(f.name);
        if p.exists() {
            std::fs::remove_file(&p).map_err(|e| e.to_string())?;
        }
    }
    let _ = std::fs::remove_dir(dir());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn both_files_are_pinned_to_a_commit_on_hugging_face() {
        for f in FILES {
            assert_eq!(f.sha256.len(), 64, "{}", f.name);
            assert!(
                f.url.starts_with("https://huggingface.co/opencv/"),
                "{}",
                f.url
            );
            assert!(!f.url.contains("/resolve/main/"), "{}", f.url);
            assert!(f.url.ends_with(f.name), "{}", f.url);
        }
    }
}
