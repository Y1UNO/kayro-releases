//! « Le cerveau » (step 21, 2026-11-04, the user's go: CLAUDE.md, « interprète de commandes
//! vocales »): Gemma 4 E4B (Google, Apache 2.0) listening to the sentence itself, on the graphics
//! card through llama.cpp (Vulkan build, MIT), in a process of its own that dies with Kayro (a job
//! object) and answers only Kayro, on 127.0.0.1, behind a random key. It hears and understands
//! at once: « Arya, tu pourrais m'activer Spotify et mettre Discord sur mon premier écran » →
//! two actions, bound by a grammar to the user's own apps (prompt.rs). Downloaded on demand
//! (models.rs: ≈ 5.2 GB); without it, or when it fails, the classic way (Parakeet and the rules)
//! answers. Measured on the user's calibration: 0.16 s a sentence, ≈ 5 GB of graphics memory,
//! 4.4 s to load (the very first start also compiles the card's shaders, ≈ 35 s, kept by the
//! driver).

pub mod apps;
mod http;
pub mod prompt;
pub mod slot;
#[cfg(test)]
#[path = "user_tests.rs"]
mod user_tests;

use std::collections::hash_map::RandomState;
use std::hash::BuildHasher;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use sha2::{Digest, Sha256};

use crate::platform::job::Job;

pub const DIR: &str = "brain";
pub const RUNTIME_ZIP: &str = "llama-b12110-bin-win-vulkan-x64.zip";
pub const RUNTIME_DIR: &str = "llama";
pub const MODEL: &str = "gemma-4-E4B-it-Q4_0.gguf";
pub const MMPROJ: &str = "mmproj-gemma-4-E4B-it-Q8_0.gguf";

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
/// Loading takes ≈ 5 s (≈ 35 s the very first time, while the driver compiles the shaders).
const READY_WITHIN: Duration = Duration::from_secs(90);
/// A sentence slower than this is answered the classic way (the card is busy with a windowed
/// game, or there is none): every answer measured on 2026-11-04 took less than 0.5 s.
const ANSWER_WITHIN: Duration = Duration::from_secs(3);

pub fn dir() -> PathBuf {
    super::engine::voice_dir().join(DIR)
}

/// How many servers run (0 or 1): its files cannot be removed while one does.
static ALIVE: AtomicUsize = AtomicUsize::new(0);
/// Asked to let go (its files are being removed): not started again until released.
static HELD_OFF: AtomicBool = AtomicBool::new(false);

pub fn alive() -> bool {
    ALIVE.load(Ordering::SeqCst) > 0
}

pub fn held_off() -> bool {
    HELD_OFF.load(Ordering::SeqCst)
}

pub fn hold_off(on: bool) {
    HELD_OFF.store(on, Ordering::SeqCst);
}

/// Its files are all there (the runtime unpacked).
pub fn installed(dir: &Path) -> bool {
    dir.join(RUNTIME_DIR).join("llama-server.exe").is_file()
        && dir.join(MODEL).is_file()
        && dir.join(MMPROJ).is_file()
}

pub struct Brain {
    child: Child,
    _job: Option<Job>,
    port: u16,
    key: String,
}

/// A port nobody listens on right now (another program could take it in the few ms before the
/// server does: it then fails to start, and the classic way answers until the retry).
fn free_port() -> Result<u16, String> {
    let l = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    l.local_addr().map(|a| a.port()).map_err(|e| e.to_string())
}

/// A key nobody else knows (only Kayro may ask the server).
fn secret() -> String {
    let mut h = Sha256::new();
    h.update(std::process::id().to_le_bytes());
    h.update(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
            .to_le_bytes(),
    );
    let local = 0u8;
    h.update((&local as *const u8 as usize).to_le_bytes());
    // The hash map's seeds: random from the OS, new for each process.
    h.update(RandomState::new().hash_one(0u8).to_le_bytes());
    h.update(RandomState::new().hash_one(1u8).to_le_bytes());
    format!("{:x}", h.finalize())
}

/// The harnesses try server flags without a rebuild (`KAYRO_VOICE_BRAIN_ARGS="-fa on"`).
#[cfg(test)]
fn extra_args() -> Vec<String> {
    std::env::var("KAYRO_VOICE_BRAIN_ARGS")
        .map(|a| a.split_whitespace().map(String::from).collect())
        .unwrap_or_default()
}

#[cfg(not(test))]
fn extra_args() -> Vec<String> {
    Vec::new()
}

/// The server's own log (what it loads and how long each answer took, never the sound nor the
/// words), beside Kayro's; the harnesses keep theirs out of the user's data.
fn log_path() -> PathBuf {
    if cfg!(test) {
        std::env::temp_dir().join("kayro-brain-test.log")
    } else {
        crate::paths::logs_dir().join("brain.log")
    }
}

impl Brain {
    /// Starts the server and waits until the model is loaded (`Err`: missing, refused, too slow).
    pub fn start(dir: &Path) -> Result<Self, String> {
        Self::start_unless(dir, &AtomicBool::new(false))
    }

    /// `start`, given up as soon as `cancel` is raised (the server is killed).
    pub fn start_unless(dir: &Path, cancel: &AtomicBool) -> Result<Self, String> {
        if !installed(dir) {
            return Err("brain".into());
        }
        let runtime = dir.join(RUNTIME_DIR);
        let port = free_port()?;
        let key = secret();
        let log = std::fs::File::create(log_path())
            .map(Stdio::from)
            .unwrap_or_else(|_| Stdio::null());
        let mut cmd = Command::new(runtime.join("llama-server.exe"));
        cmd.arg("-m")
            .arg(dir.join(MODEL))
            .arg("--mmproj")
            .arg(dir.join(MMPROJ))
            .args(["--host", "127.0.0.1", "--port", &port.to_string()])
            .args(["-ngl", "99", "-c", "8192", "-np", "1", "--no-ui"])
            .args(["--api-key", &key])
            .args(extra_args())
            .current_dir(&runtime)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(log);
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let child = cmd.spawn().map_err(|e| format!("start: {e}"))?;
        ALIVE.fetch_add(1, Ordering::SeqCst);
        let job = Job::holding(&child);
        let mut brain = Self {
            child,
            _job: job,
            port,
            key,
        };
        let started = Instant::now();
        loop {
            if cancel.load(Ordering::SeqCst) {
                return Err("let go while loading".into());
            }
            if let Ok(Some(status)) = brain.child.try_wait() {
                return Err(format!("stopped: {status}"));
            }
            let health = http::request(
                port,
                "GET",
                "/health",
                &brain.key,
                "",
                Duration::from_secs(2),
            );
            if health.is_ok_and(|r| r.status == 200) {
                break;
            }
            if started.elapsed() > READY_WITHIN {
                return Err("not ready in time".into());
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        tracing::info!(
            ms = started.elapsed().as_millis() as u64,
            "voice: the brain is ready"
        );
        Ok(brain)
    }

    /// What the sentence `audio` (16 kHz) asks, in the brain's lines (prompt.rs reads them);
    /// `hint`: a word before it (« it follows a call »).
    pub fn ask(
        &self,
        system: &str,
        grammar: &str,
        audio: &[f32],
        hint: Option<&str>,
    ) -> Result<String, String> {
        let wav = super::engine::wav(audio);
        let mut content = Vec::new();
        if let Some(h) = hint {
            content.push(serde_json::json!({ "type": "text", "text": h }));
        }
        content.push(serde_json::json!({ "type": "input_audio",
            "input_audio": { "data": http::base64(&wav), "format": "wav" } }));
        let body = serde_json::json!({
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": content }
            ],
            "temperature": 0,
            "max_tokens": 60,
            "grammar": grammar,
            "cache_prompt": true,
        });
        let reply = http::request(
            self.port,
            "POST",
            "/v1/chat/completions",
            &self.key,
            &body.to_string(),
            ANSWER_WITHIN,
        )?;
        if reply.status != 200 {
            // A 500 happens on rare sentences (llama.cpp's grammar choking on a control token
            // the model picked, « <unused32> », once in 22 synthetic sentences on 2026-11-04;
            // banning those tokens by logit bias made the answers run on: dropped). The classic
            // way answers.
            return Err(format!("status {}", reply.status));
        }
        let v: serde_json::Value = serde_json::from_str(&reply.body).map_err(|e| e.to_string())?;
        v["choices"][0]["message"]["content"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| "no answer".into())
    }

    pub fn running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }
}

impl Drop for Brain {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        ALIVE.fetch_sub(1, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_key_is_its_own() {
        let (a, b) = (secret(), secret());
        assert_eq!(a.len(), 64);
        assert_ne!(a, b);
    }

    #[test]
    fn the_brain_is_installed_only_with_its_three_files() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!installed(dir.path()));
        std::fs::create_dir_all(dir.path().join(RUNTIME_DIR)).unwrap();
        for name in [MODEL, MMPROJ] {
            std::fs::write(dir.path().join(name), b"x").unwrap();
        }
        assert!(!installed(dir.path()));
        std::fs::write(dir.path().join(RUNTIME_DIR).join("llama-server.exe"), b"x").unwrap();
        assert!(installed(dir.path()));
        assert!(Brain::start(dir.path()).is_err());
    }
}
