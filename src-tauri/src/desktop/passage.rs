//! Passages between display modes (art direction round 4b, R4b-Modes.txt, fade version).
//!
//! The windows stay opaque: spike 4b-2.0 measured that a transparent `main` makes the compositor
//! (dwm) spend about 3 × its GPU at rest, for good. So a passage fades the page's content out on
//! its opaque background, reconfigures or swaps the window while nothing shows (the stale frame
//! of a resize, ~100 ms, is lost in the dark), then the page brings its content back in a
//! cascade. The page drives the fades; the core waits for it, within a time limit, before it
//! touches the window.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime};
use tauri_specta::Event;

use super::{lock, DesktopState};

/// How long the core waits for a page to have faded out before going on anyway (the fade itself
/// lasts « micro », 140 ms; a page that does not answer must not block a mode change).
const FADE_WAIT: Duration = Duration::from_millis(600);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PassageStep {
    /// Fade your content out, then call `passage_faded(id)`.
    Out,
    /// The window is ready (new size, or shown): bring your content back.
    In,
}

/// How the native veil fades when `main` gives way to the widget or takes over from it (round
/// 4b): sent by the page that faded out. The colour it faded to (its opaque background), how long,
/// and the motion table's curve sampled evenly from 0 to 1.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VeilFade {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub ms: u32,
    pub curve: Vec<f32>,
}

impl VeilFade {
    /// A page's values within sane bounds (≤ 2 s, ≤ 64 finite samples), None if unusable.
    pub fn sane(mut self) -> Option<Self> {
        self.ms = self.ms.min(2000);
        if self.curve.len() < 2
            || self.curve.len() > 64
            || self.curve.iter().any(|v| !v.is_finite())
        {
            return None;
        }
        Some(self)
    }

    /// Progress of the fade (0 → 1, the curve's value) `elapsed` ms after it starts.
    pub fn at(&self, elapsed: f32) -> f32 {
        if self.ms == 0 || self.curve.len() < 2 {
            return 1.0;
        }
        let n = (self.curve.len() - 1) as f32;
        let u = (elapsed / self.ms as f32).clamp(0.0, 1.0) * n;
        let i = (u.floor() as usize).min(self.curve.len() - 2);
        let (a, b) = (self.curve[i], self.curve[i + 1]);
        a + (b - a) * (u - i as f32)
    }
}

/// A step of a passage, for the page of window `label`.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct ModePassage {
    pub id: u32,
    pub step: PassageStep,
    pub label: String,
}

/// The passage whose fade-out is awaited (one at a time: a newer one releases the older).
#[derive(Default)]
pub struct Waiting {
    next: AtomicU32,
    current: Mutex<Option<(u32, Sender<Option<VeilFade>>)>>,
}

impl Waiting {
    /// A new passage: its id, and what tells when its page has faded out. Replacing a passage
    /// still waiting releases it at once (its sender is dropped).
    pub fn start(&self) -> (u32, Receiver<Option<VeilFade>>) {
        let id = self.next.fetch_add(1, Ordering::SeqCst) + 1;
        let (tx, rx) = mpsc::channel();
        *lock(&self.current) = Some((id, tx));
        (id, rx)
    }

    /// The page of passage `id` has faded out (with how a veil should fade, if one is used).
    /// False for an unknown or older passage.
    pub fn release(&self, id: u32, veil: Option<VeilFade>) -> bool {
        let mut current = lock(&self.current);
        match current.as_ref() {
            Some((n, _)) if *n == id => {
                if let Some((_, tx)) = current.take() {
                    let _ = tx.send(veil.and_then(VeilFade::sane));
                }
                true
            }
            _ => false,
        }
    }
}

fn emit<R: Runtime>(app: &AppHandle<R>, id: u32, step: PassageStep, label: &str) {
    crate::ipc::notify(
        ModePassage {
            id,
            step,
            label: label.to_string(),
        }
        .emit(app),
    );
}

/// Asks the page of window `label` to fade out, then runs `then` on another thread once it has
/// (or after `FADE_WAIT`). `then` receives the passage id (for `fade_in`) and the page's veil
/// (None when it answered nothing, or when the change is direct).
pub fn fade_out_then<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    then: impl FnOnce(AppHandle<R>, u32, Option<VeilFade>) + Send + 'static,
) {
    let (id, done) = app.state::<DesktopState>().passage.start();
    emit(app, id, PassageStep::Out, label);
    let app = app.clone();
    std::thread::spawn(move || {
        let veil = done.recv_timeout(FADE_WAIT).ok().flatten();
        then(app, id, veil);
    });
}

/// Tells the page of window `label` that it can bring its content back.
pub fn fade_in<R: Runtime>(app: &AppHandle<R>, id: u32, label: &str) {
    emit(app, id, PassageStep::In, label);
}

/// Called by the page once it has faded out.
pub fn faded<R: Runtime>(app: &AppHandle<R>, id: u32, veil: Option<VeilFade>) {
    app.state::<DesktopState>().passage.release(id, veil);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_passage_is_released_by_its_own_id_only() {
        let w = Waiting::default();
        let (id, rx) = w.start();
        assert!(!w.release(id + 1, None));
        assert!(rx.try_recv().is_err());
        assert!(w.release(id, Some(fade(240))));
        assert_eq!(rx.try_recv(), Ok(Some(fade(240))));
        assert!(!w.release(id, None)); // already released
    }

    #[test]
    fn a_newer_passage_releases_the_older_one_at_once() {
        let w = Waiting::default();
        let (first, old) = w.start();
        let (second, _new) = w.start();
        assert!(second > first);
        // The older one's sender is gone: its wait ends now instead of after FADE_WAIT.
        assert!(matches!(
            old.recv_timeout(Duration::from_millis(50)),
            Err(mpsc::RecvTimeoutError::Disconnected)
        ));
        assert!(!w.release(first, None));
    }

    fn fade(ms: u32) -> VeilFade {
        VeilFade {
            r: 15,
            g: 10,
            b: 22,
            ms,
            curve: vec![0.0, 0.25, 0.75, 1.0],
        }
    }

    #[test]
    fn the_veil_follows_the_pages_curve_over_its_duration() {
        let f = fade(300);
        assert_eq!(f.at(0.0), 0.0);
        assert!((f.at(50.0) - 0.125).abs() < 1e-6); // a sixth of the way: halfway to 0.25
        assert!((f.at(150.0) - 0.5).abs() < 1e-6);
        assert_eq!(f.at(300.0), 1.0);
        assert_eq!(f.at(900.0), 1.0);
        assert_eq!(fade(0).at(0.0), 1.0);
    }

    #[test]
    fn a_pages_veil_is_kept_within_bounds() {
        assert_eq!(fade(9000).sane().map(|f| f.ms), Some(2000));
        let bad = VeilFade {
            curve: vec![0.0, f32::NAN],
            ..fade(200)
        };
        assert_eq!(bad.sane(), None);
        let short = VeilFade {
            curve: vec![1.0],
            ..fade(200)
        };
        assert_eq!(short.sane(), None);
    }
}
