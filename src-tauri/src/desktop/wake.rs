//! 2026-10-31, « réveil »: started with Windows on the intro or the immersive mode, the hub's
//! screen goes dark at once with « Kayro · se réveille » (a native veil, `platform::veil`), a few
//! milliseconds after the process starts and long before the page is ready. Once Kayro's window
//! is on screen, the cover fades into it and goes. Never more than `LIMIT`, whatever happens.

use std::sync::atomic::{AtomicIsize, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Runtime};

use super::geometry::Screen;
use crate::platform::veil::{self, ScreenRect, WakeText};

/// Texts of the cover (the message catalogue is on the interface side, like the tray's menu).
const TEXT: WakeText = WakeText {
    title: "Kayro",
    line: "se réveille…",
    title_rgb: (236, 232, 244),
    line_rgb: (150, 146, 172),
};
/// The colour `main` shows before its first paint (windows.rs `BACKGROUND`).
const DARK: (u8, u8, u8) = (6, 6, 12);
/// After Kayro's window is shown: a moment for it to paint, then the fade.
const SETTLE: Duration = Duration::from_millis(60);
const FADE: Duration = Duration::from_millis(280);
const STEP: Duration = Duration::from_millis(8);
/// The cover goes after this long even if Kayro's window never came.
const LIMIT: Duration = Duration::from_secs(20);

/// The cover on screen (its window handle), 0 when none.
static COVER: AtomicIsize = AtomicIsize::new(0);

/// Shows the cover over `screen`. On the event-loop thread.
pub fn cover<R: Runtime>(app: &AppHandle<R>, screen: &Screen) {
    let r = screen.rect;
    let rect = ScreenRect {
        x: r.x,
        y: r.y,
        width: i32::try_from(r.width).unwrap_or(i32::MAX),
        height: i32::try_from(r.height).unwrap_or(i32::MAX),
    };
    let Some(raw) = veil::show_wake(rect, DARK, TEXT) else {
        tracing::warn!("wake cover refused by Windows");
        return;
    };
    COVER.store(raw, Ordering::SeqCst);
    let since_start = crate::STARTED.get().map(|s| s.elapsed().as_millis() as u64);
    tracing::info!(?since_start, "wake cover shown");
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(LIMIT);
        if COVER.load(Ordering::SeqCst) == raw {
            tracing::warn!("wake cover: Kayro's window never came, the cover goes");
            lift(&app);
        }
    });
}

/// Kayro's window is on screen: the cover (if any) fades into it, then goes.
pub fn lift<R: Runtime>(app: &AppHandle<R>) {
    let raw = COVER.swap(0, Ordering::SeqCst);
    if raw == 0 {
        return;
    }
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(SETTLE);
        let start = Instant::now();
        loop {
            let k = (start.elapsed().as_secs_f32() / FADE.as_secs_f32()).min(1.0);
            // Ease-in-out: the text dims gently, then the last of the dark goes quickly.
            let eased = k * k * (3.0 - 2.0 * k);
            let alpha = (255.0 * (1.0 - eased)).round() as u8;
            let _ = app.run_on_main_thread(move || veil::set_alpha(raw, alpha));
            if k >= 1.0 {
                break;
            }
            thread::sleep(STEP);
        }
        let _ = app.run_on_main_thread(move || veil::destroy(raw));
    });
}
