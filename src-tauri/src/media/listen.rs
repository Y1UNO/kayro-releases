//! Step 20 and the music mode (2026-11-03): the island's listening thread. It reads the sound
//! played (loopback.rs) and sends the bars (beat.rs) about 30 times a second and, while the
//! music mode is on and not on its test track, the music frames (music.rs): at most every 10 ms
//! when there are hits, at least every 16 ms for the levels (every 250 ms when nothing moves).
//! The detection sensitivities are read again every 250 ms. Nothing is kept.

use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, Runtime};
use tauri_specta::Event;

use super::music::{Analyzer, Levels, MusicHit};
use super::rhythm::Rhythm;
use super::{beat, MediaBeat, MusicFrame};
use crate::config::schema::Quality;
use crate::config::visual::MusicQuality;
use crate::config::ConfigState;
use crate::platform::loopback::Capture;

const BARS_EVERY: Duration = Duration::from_millis(33);
/// How often the sound is read while the music mode listens (its analysis needs every 5 ms).
const MUSIC_POLL: Duration = Duration::from_millis(4);
const HITS_EVERY: Duration = Duration::from_millis(10);
const LEVELS_EVERY: Duration = Duration::from_millis(16);
const IDLE_EVERY: Duration = Duration::from_millis(250);
const SETTINGS_EVERY: Duration = Duration::from_millis(250);
/// No sound for this long: the players stopped their streams; silence is analysed instead, so
/// that the levels fall as they would.
const SILENT_AFTER: Duration = Duration::from_millis(40);

/// The music mode's side: its analyzer while the mode is on, and the frames' pace.
struct Music {
    rate: u32,
    analyzer: Option<Analyzer>,
    /// The AI's beat grid, while the analyzer runs (none at the « Basse » quality).
    rhythm: Option<Rhythm>,
    hits: Vec<MusicHit>,
    seq: u32,
    sent: Levels,
    sent_at: Instant,
    checked_at: Option<Instant>,
    /// The grid was started once for this listening (its files missing: not again).
    rhythm_tried: bool,
}

/// Where the AI's files are: `ai/` among Kayro's resources (next to the exe in a local build).
fn models_dir<R: Runtime>(app: &AppHandle<R>) -> std::path::PathBuf {
    let bundled = app.path().resource_dir().map(|d| d.join("ai"));
    match bundled {
        Ok(d) if d.is_dir() => d,
        _ => std::env::current_exe()
            .ok()
            .and_then(|e| e.parent().map(|p| p.join("ai")))
            .unwrap_or_default(),
    }
}

/// Two states the eye cannot tell apart.
fn same(a: &Levels, b: &Levels) -> bool {
    let close = |x: f32, y: f32| (x - y).abs() < 2e-3;
    close(a.sub, b.sub)
        && close(a.melody, b.melody)
        && close(a.pitch, b.pitch)
        && close(a.build, b.build)
        && close(a.voice, b.voice)
        && (a.gap, a.section) == (b.gap, b.section)
}

impl Music {
    /// The music mode on or off, and its sensitivities (Avancé), from the settings.
    fn follow_settings<R: Runtime>(&mut self, app: &AppHandle<R>) {
        if self
            .checked_at
            .is_some_and(|t| t.elapsed() < SETTINGS_EVERY)
        {
            return;
        }
        self.checked_at = Some(Instant::now());
        let Some(config) = app.try_state::<ConfigState>() else {
            return;
        };
        let s = config.settings();
        if !s.island_music || s.music_demo {
            if self.analyzer.take().is_some() {
                tracing::info!("island: the music mode stops listening");
            }
            (self.rhythm, self.rhythm_tried) = (None, false);
            return;
        }
        let light = s.music_quality == MusicQuality::Low
            || (s.music_quality == MusicQuality::Auto && s.quality == Quality::Eco);
        if light {
            (self.rhythm, self.rhythm_tried) = (None, false);
        } else if self.rhythm.is_none() && !self.rhythm_tried {
            self.rhythm_tried = true;
            self.rhythm = Rhythm::start(app, models_dir(app), self.rate);
        }
        let rate = self.rate;
        let analyzer = self.analyzer.get_or_insert_with(|| {
            tracing::info!(rate, "island: the music mode listens");
            Analyzer::new(rate)
        });
        let senses = [
            s.music_sense_kick,
            s.music_sense_snare,
            s.music_sense_hat,
            s.music_sense_crash,
        ];
        analyzer.set_senses(senses);
    }

    fn push(&mut self, samples: &[f32], side: &[f32]) {
        if let Some(analyzer) = &mut self.analyzer {
            analyzer.push_stereo(samples, side, &mut self.hits);
        }
        if let Some(rhythm) = &self.rhythm {
            rhythm.push(samples);
        }
    }

    /// Sends a frame when one is due.
    fn send<R: Runtime>(&mut self, app: &AppHandle<R>) {
        let Some(analyzer) = &self.analyzer else {
            return;
        };
        let (since, levels) = (self.sent_at.elapsed(), analyzer.levels());
        let due = if self.hits.is_empty() {
            since >= LEVELS_EVERY && (since >= IDLE_EVERY || !same(&levels, &self.sent))
        } else {
            since >= HITS_EVERY
        };
        if !due {
            return;
        }
        self.seq = self.seq.wrapping_add(1);
        let frame = MusicFrame {
            hits: std::mem::take(&mut self.hits),
            sub: levels.sub,
            melody: levels.melody,
            voice: levels.voice,
            pitch: levels.pitch,
            build: levels.build,
            gap: levels.gap,
            section: levels.section,
            seq: self.seq,
        };
        crate::ipc::notify(frame.emit(app));
        (self.sent, self.sent_at) = (levels, Instant::now());
    }
}

/// Listens while `on()`: the bars always, the music mode's frames while it is on.
pub fn run<R: Runtime>(app: &AppHandle<R>, capture: &Capture, on: impl Fn() -> bool) {
    let mut bars = beat::Analyzer::new(capture.rate);
    let mut music = Music {
        rate: capture.rate,
        analyzer: None,
        rhythm: None,
        rhythm_tried: false,
        hits: Vec::new(),
        seq: 0,
        sent: Levels::default(),
        sent_at: Instant::now(),
        checked_at: None,
    };
    let mut fresh = Vec::with_capacity(capture.rate as usize / 10);
    let mut side = Vec::with_capacity(capture.rate as usize / 10);
    let mut for_bars = Vec::with_capacity(beat::WINDOW * 4);
    let (mut bars_at, mut heard_at) = (Instant::now(), Instant::now());
    while on() {
        music.follow_settings(app);
        let poll = if music.analyzer.is_some() {
            MUSIC_POLL
        } else {
            BARS_EVERY
        };
        std::thread::sleep(poll);
        capture.read(&mut fresh, &mut side);
        if !fresh.is_empty() {
            heard_at = Instant::now();
        } else if heard_at.elapsed() >= SILENT_AFTER {
            let samples = heard_at.elapsed().as_secs_f64() * f64::from(capture.rate);
            fresh.resize((samples as usize).min(capture.rate as usize / 5), 0.0);
            side.resize(fresh.len(), 0.0);
            heard_at = Instant::now();
        }
        music.push(&fresh, &side);
        for_bars.extend_from_slice(&fresh);
        fresh.clear();
        side.clear();
        if bars_at.elapsed() >= BARS_EVERY {
            bars_at = Instant::now();
            let keep = for_bars.len().saturating_sub(beat::WINDOW);
            let levels = bars.levels(&for_bars[keep..]);
            crate::ipc::notify(MediaBeat(levels.to_vec()).emit(app));
            for_bars.clear();
        }
        music.send(app);
    }
}
