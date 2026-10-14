//! The native veil of a passage between `main` and the widget (round 4b, option A): `main` is
//! opaque, so after its page has faded to its dark background a veil of the same colour takes its
//! place and fades into the desktop; the other way, a veil darkens the place of `main` before it
//! shows. Runs on a passage's worker thread; the veil's window lives on the event-loop thread.

use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Runtime, WebviewWindow};

use super::lock;
use super::passage::VeilFade;
use crate::platform::veil::{self, ScreenRect};

/// Lets the compositor show a just-made change (the veil, a window) before the next one.
const SETTLE: Duration = Duration::from_millis(34);
/// Pace of the opacity steps (the compositor blends each one).
const STEP: Duration = Duration::from_millis(8);

/// How long a passage's worker waits for the event-loop thread to answer.
const UI_WAIT: Duration = Duration::from_millis(500);

/// Hands `f` to `post` (which runs it on another thread, maybe much later, or drops it) and
/// waits at most `wait` for its answer. An answer that comes after the wait is nobody's: `undo`
/// gets it, on `f`'s thread (a veil nobody would destroy would stay above every window for good).
/// None when the answer came too late, or `f` never ran.
fn answer_or_undo<T: Send + 'static>(
    post: impl FnOnce(Box<dyn FnOnce() + Send>) -> bool,
    f: impl FnOnce() -> T + Send + 'static,
    undo: impl FnOnce(T) + Send + 'static,
    wait: Duration,
) -> Option<T> {
    let (tx, rx) = mpsc::channel();
    let gone = Arc::new(Mutex::new(false));
    let late = Arc::clone(&gone);
    let task = Box::new(move || {
        let value = f();
        // Under the lock: either the waiter still takes the answer, or it never will.
        let given_up = lock(&late);
        if *given_up {
            drop(given_up);
            undo(value);
        } else {
            let _ = tx.send(value);
        }
    });
    if !post(task) {
        return None;
    }
    match rx.recv_timeout(wait) {
        Ok(value) => Some(value),
        Err(_) => {
            *lock(&gone) = true;
            // Sent between the end of the wait and the lock: still ours.
            rx.try_recv().ok()
        }
    }
}

/// Runs `f` on the event-loop thread and waits for its answer (see `answer_or_undo`).
fn on_ui<R: Runtime, T: Send + 'static>(
    app: &AppHandle<R>,
    f: impl FnOnce() -> T + Send + 'static,
    undo: impl FnOnce(T) + Send + 'static,
) -> Option<T> {
    answer_or_undo(
        |task| app.run_on_main_thread(task).is_ok(),
        f,
        undo,
        UI_WAIT,
    )
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
    on_ui(
        app,
        move || veil::show(place.0, rgb, alpha, place.1),
        |late| late.into_iter().for_each(veil::destroy),
    )
    .flatten()
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    /// Runs the task on another thread after `delay` (as the event loop may).
    fn later(delay: Duration) -> impl FnOnce(Box<dyn FnOnce() + Send>) -> bool {
        move |task| {
            thread::spawn(move || {
                thread::sleep(delay);
                task();
            });
            true
        }
    }

    #[test]
    fn an_answer_in_time_is_kept() {
        let undone = Arc::new(AtomicBool::new(false));
        let u = Arc::clone(&undone);
        let got = answer_or_undo(
            later(Duration::ZERO),
            || 7,
            move |_| u.store(true, Ordering::SeqCst),
            Duration::from_millis(500),
        );
        assert_eq!(got, Some(7));
        assert!(!undone.load(Ordering::SeqCst));
        // Run at once on the caller's thread (the event-loop thread itself): kept too.
        assert_eq!(
            answer_or_undo(
                |t| {
                    t();
                    true
                },
                || 8,
                |_| {},
                Duration::ZERO
            ),
            Some(8)
        );
    }

    #[test]
    fn a_late_answer_is_undone_by_its_own_thread() {
        let (undo_tx, undone) = mpsc::channel();
        let got = answer_or_undo(
            later(Duration::from_millis(80)),
            || 7,
            move |v| {
                let _ = undo_tx.send(v);
            },
            Duration::from_millis(10),
        );
        assert_eq!(got, None);
        // The veil made too late is destroyed instead of being left on screen.
        assert_eq!(undone.recv_timeout(Duration::from_secs(2)), Ok(7));
    }

    #[test]
    fn a_task_dropped_or_refused_gives_nothing() {
        let dropped = answer_or_undo(
            |t| {
                drop(t);
                true
            },
            || 7,
            |_| {},
            Duration::from_millis(500),
        );
        assert_eq!(dropped, None);
        assert_eq!(
            answer_or_undo(|_| false, || 7, |_| {}, Duration::from_millis(500)),
            None
        );
    }
}
