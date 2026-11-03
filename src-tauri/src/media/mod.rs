//! Step 20 (Kysland): the music playing on the PC, for the island. What Windows' media controls
//! show (Spotify first): title, artist, cover and its two colours, playing or paused, where in
//! the track; three controls (previous, play/pause, next); and the beat (beat.rs) while it plays
//! and the island shows, with the music mode's signal (music.rs, 2026-11-03) while that mode is
//! on (listen.rs). All local: nothing is sent, nothing is kept but the current cover.

pub mod beat;
mod continuous;
mod form;
mod listen;
pub mod music;
mod onset;
pub mod rhythm;
mod spectrum;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime};
use tauri_specta::Event;

use crate::platform::{loopback, media as win};
use music::{MusicHit, Section};
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager as Manager;

/// The track the island shows.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
    /// The player's app id (« Spotify.exe »…).
    pub player: String,
    pub playing: bool,
    pub position_ms: f64,
    pub duration_ms: f64,
    /// When `position_ms` was read (ms since the Unix epoch, 0 unknown): the page moves it on.
    pub at_ms: f64,
    /// The cover as a data URL, and its dominant and accent colours (`#rrggbb`).
    pub cover: Option<String>,
    pub colors: Option<[String; 2]>,
}

/// The music changed (None: nothing plays any more).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct MediaChanged(pub Option<NowPlaying>);

/// The beat: five levels (0–1), bass to treble, about 30 times a second while asked for.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct MediaBeat(pub Vec<f32>);

/// The music mode's signal (2026-11-03), while the beat is followed and the mode is on (not on
/// its test track): the hits since the frame before (a frame at most every 10 ms when there are
/// some), and at least every 16 ms the levels: sub-bass, melody, its pitch, the build's tension
/// (all 0–1), the silence just before a drop, where the song is. As soon as the sound is read,
/// so the page delays the image by « Décalage son/image ». `seq` counts the frames.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct MusicFrame {
    pub hits: Vec<MusicHit>,
    pub sub: f32,
    pub melody: f32,
    /// A voice (what sits in the middle of the stereo, 300–3400 Hz), 0–1 (2026-11-03).
    pub voice: f32,
    pub pitch: f32,
    pub build: f32,
    pub gap: bool,
    pub section: Section,
    pub seq: u32,
}

/// The music mode's beat grid (rhythm.rs, an AI, local), every 8 s while the mode listens: how
/// long ago (s) each beat and each downbeat of the last 10 s was, at the moment it is sent.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct MusicBeats {
    pub beats: Vec<f32>,
    pub downbeats: Vec<f32>,
    pub seq: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum MediaAction {
    Previous,
    Toggle,
    Next,
}

struct Watch {
    manager: Manager,
    last: Mutex<Option<NowPlaying>>,
    /// The cover read for a track (its key: title, artist, player).
    cover: Mutex<(String, Option<String>, Option<[String; 2]>)>,
}

static WATCH: OnceLock<Option<Arc<Watch>>> = OnceLock::new();
static BEAT_ON: AtomicBool = AtomicBool::new(false);
static BEAT_RUNNING: AtomicBool = AtomicBool::new(false);

const BASE64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Plain base64 (for the cover's data URL).
pub fn base64(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = chunk
            .iter()
            .enumerate()
            .fold(0u32, |n, (i, b)| n | u32::from(*b) << (16 - 8 * i));
        for k in 0..4 {
            if k <= chunk.len() {
                out.push(BASE64[(n >> (18 - 6 * k) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

/// The image type of cover bytes (from their first bytes).
fn mime(bytes: &[u8]) -> &'static str {
    match bytes {
        [0x89, b'P', b'N', b'G', ..] => "image/png",
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => "image/webp",
        _ => "image/jpeg",
    }
}

fn watch<R: Runtime>(app: &AppHandle<R>) -> Option<Arc<Watch>> {
    WATCH
        .get_or_init(|| {
            let manager = win::manager()?;
            let w = Arc::new(Watch {
                manager: manager.clone(),
                last: Mutex::new(None),
                cover: Mutex::new((String::new(), None, None)),
            });
            let (app, follow) = (app.clone(), w.clone());
            win::follow(&manager, Arc::new(move || refresh(&app, &follow)));
            Some(w)
        })
        .clone()
}

/// Reads the music again and tells the page when it changed.
fn refresh<R: Runtime>(app: &AppHandle<R>, w: &Watch) {
    win::mta();
    let session = win::pick(&w.manager);
    let now = session.as_ref().and_then(|s| {
        let t = win::read(s)?;
        let key = format!("{}\u{1f}{}\u{1f}{}", t.title, t.artist, t.player);
        let mut cover = w.cover.lock().unwrap_or_else(|e| e.into_inner());
        if cover.0 != key || cover.1.is_none() {
            let bytes = win::cover(s);
            let colors = bytes
                .as_deref()
                .and_then(|b| crate::art::palette::extract(b).ok())
                .map(|p| {
                    let hex = |i: u8| {
                        p.colors
                            .get(i as usize)
                            .map(|c| c.hex.clone())
                            .unwrap_or_default()
                    };
                    [hex(p.dominant), hex(p.accent)]
                });
            let url = bytes.map(|b| format!("data:{};base64,{}", mime(&b), base64(&b)));
            *cover = (key, url, colors);
        }
        Some(NowPlaying {
            title: t.title,
            artist: t.artist,
            player: t.player,
            playing: t.playing,
            position_ms: t.position_ms,
            duration_ms: t.duration_ms,
            at_ms: t.at_ms,
            cover: cover.1.clone(),
            colors: cover.2.clone(),
        })
    });
    let mut last = w.last.lock().unwrap_or_else(|e| e.into_inner());
    if *last != now {
        *last = now.clone();
        crate::ipc::notify(MediaChanged(now).emit(app));
    }
}

/// The music now (starts following the players the first time).
pub fn now<R: Runtime>(app: &AppHandle<R>) -> Option<NowPlaying> {
    let w = watch(app)?;
    refresh(app, &w);
    let now = w.last.lock().unwrap_or_else(|e| e.into_inner()).clone();
    now
}

/// Previous, play/pause or next on the player shown.
pub fn control<R: Runtime>(app: &AppHandle<R>, action: MediaAction) -> bool {
    let Some(w) = watch(app) else { return false };
    let what = match action {
        MediaAction::Previous => win::Control::Previous,
        MediaAction::Toggle => win::Control::Toggle,
        MediaAction::Next => win::Control::Next,
    };
    win::control(&w.manager, what)
}

/// Follows the beat while `on` (music plays and the island shows), and the music mode's signal
/// while that mode is on; off, the listening stops.
pub fn beat<R: Runtime>(app: &AppHandle<R>, on: bool) {
    BEAT_ON.store(on, Ordering::SeqCst);
    if !on || BEAT_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("island-beat".into())
        .spawn(move || {
            if let Some(capture) = loopback::Capture::open() {
                listen::run(&app, &capture, || BEAT_ON.load(Ordering::SeqCst));
            } else {
                tracing::info!("island: the sound played cannot be listened to (no beat)");
            }
            BEAT_RUNNING.store(false, Ordering::SeqCst);
        });
    if spawned.is_err() {
        BEAT_RUNNING.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_matches_the_standard() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
        assert_eq!(base64(&[0xff, 0xfe, 0xfd]), "//79");
    }

    #[test]
    fn a_cover_is_typed_by_its_first_bytes() {
        assert_eq!(mime(&[0x89, b'P', b'N', b'G', 0, 0]), "image/png");
        assert_eq!(mime(b"RIFF\0\0\0\0WEBPVP8 "), "image/webp");
        assert_eq!(mime(&[0xff, 0xd8, 0xff]), "image/jpeg");
    }
}
