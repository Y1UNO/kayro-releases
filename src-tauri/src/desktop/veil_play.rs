//! The native veil of a passage between `main` and the widget (round 4b, option A): `main` is
//! opaque, so after its page has faded to its dark background a veil of the same colour takes its
//! place and fades into the desktop; the other way, a veil darkens the place of `main` before it
//! shows. Runs on a passage's worker thread; the veil's window lives on the event-loop thread.

use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Runtime, WebviewWindow};

use super::passage::VeilFade;
use crate::platform::veil::{self, ScreenRect};

/// Lets the compositor show a just-made change (the veil, a window) before the next one.
const SETTLE: Duration = Duration::from_millis(34);
/// Pace of the opacity steps (the compositor blends each one).
const STEP: Duration = Duration::from_millis(8);

/// Runs `f` on the event-loop thread and waits for its answer.
fn on_ui<R: Runtime, T: Send + 'static>(
    app: &AppHandle<R>,
    f: impl FnOnce() -> T + Send + 'static,
) -> Option<T> {
    let (tx, rx) = mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(f());
    })
    .ok()?;
    rx.recv_timeout(Duration::from_millis(500)).ok()
}

/// Where a window is on screen, and whether it has a frame (rounded corners on Windows 11).
pub fn place_of<R: Runtime>(window: &WebviewWindow<R>) -> Option<(ScreenRect, bool)> {
    let raw = window.hwnd().ok()?.0 as isize;
    let framed = window.is_decorated().unwrap_or(false);
    veil::visible_rect(raw).map(|r| (r, framed))
}

fn show<R: Runtime>(
    app: &AppHandle<R>,
    place: (ScreenRect, bool),
    f: &VeilFade,
    alpha: u8,
) -> Option<isize> {
    let rgb = (f.r, f.g, f.b);
    on_ui(app, move || veil::show(place.0, rgb, alpha, place.1)).flatten()
}

/// Opacity from `from` to `to` along the page's curve, then waits for the last step.
fn play<R: Runtime>(app: &AppHandle<R>, raw: isize, f: &VeilFade, from: u8, to: u8) {
    let start = Instant::now();
    loop {
        let elapsed = start.elapsed().as_secs_f32() * 1000.0;
        let k = f.at(elapsed);
        let alpha = (f32::from(from) + (f32::from(to) - f32::from(from)) * k).round();
        let alpha = alpha.clamp(0.0, 255.0) as u8;
        let _ = app.run_on_main_thread(move || veil::set_alpha(raw, alpha));
        if elapsed >= f.ms as f32 {
            break;
        }
        thread::sleep(STEP);
    }
    thread::sleep(SETTLE);
}

fn destroy<R: Runtime>(app: &AppHandle<R>, raw: isize) {
    let _ = app.run_on_main_thread(move || veil::destroy(raw));
}

/// `main` → widget: a veil of `main`'s dark colour covers it, `swap` shows the widget (in front)
/// and retires `main`, then the veil fades into the desktop.
pub fn cover_then_clear<R: Runtime>(
    app: &AppHandle<R>,
    place: Option<(ScreenRect, bool)>,
    f: &VeilFade,
    swap: impl FnOnce(),
) {
    let raw = place.and_then(|p| show(app, p, f, 255));
    if raw.is_some() {
        thread::sleep(SETTLE);
    }
    swap();
    if let Some(raw) = raw {
        play(app, raw, f, 255, 0);
        destroy(app, raw);
    }
}

/// Widget → `main`: a veil darkens the place of `main` (the widget has faded out), `swap` shows
/// `main` (dark, its page then comes in) under it, then the veil goes.
pub fn darken_then_lift<R: Runtime>(
    app: &AppHandle<R>,
    place: Option<(ScreenRect, bool)>,
    f: &VeilFade,
    swap: impl FnOnce(),
) {
    let raw = place.and_then(|p| show(app, p, f, 0));
    if let Some(raw) = raw {
        play(app, raw, f, 0, 255);
    }
    swap();
    if let Some(raw) = raw {
        thread::sleep(SETTLE);
        destroy(app, raw);
    }
}
