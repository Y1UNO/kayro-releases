//! Kysland's music mode (2026-11-02). « Mode musique » on (the opened island's switch) and music
//! playing, the island leaves its place for the middle of its screen and dances with the music
//! there (the page draws it all, `src/features/island/stage/`). Meanwhile its window covers the
//! whole screen, but its region (what shows and takes clicks) is only where the page draws: a
//! few rectangles around the drop and its figures, sent by the page as they move (at most about
//! 20 times a second). Everywhere else, clicks reach the windows below. A program in full screen,
//! or Kayro coming, ends it at once.
//!
//! The switches never show a frame of nothing nor a frame in the wrong place. Going: the window
//! first grows to the screen's size **without moving** (what it shows stays put: the island),
//! the page draws the drop where the island will be once the window has moved (`Ready`), then
//! the window moves to the screen's corner (`Go`): the drop is where the island was. Coming
//! back, the same in reverse (`Done`): the page shows the island again at its place in the
//! window, the window moves back, then shrinks.
//!
//! (Not `set_ignore_cursor_events`: it makes the window layered without giving it its opacity,
//! and Windows then draws nothing of it.)

use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, WebviewWindow};
use tauri_specta::Event;

use super::{
    drive, is_docked, locate, region_now, slot_now, slots, tuck, win, window_size, Region, OPEN,
};
use crate::config::ui_state::Rect;
use crate::desktop::geometry::Screen;
use crate::desktop::windows::{self, WIDGET};

/// The music mode's window, for the page (logical pixels of the stage: the screen).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct IslandStage {
    /// On (the window covers the screen) or back to the island.
    pub on: bool,
    pub width: f64,
    pub height: f64,
    /// Where the island's anchor (the middle of its top edge) is, and goes back to.
    pub home_x: f64,
    pub home_y: f64,
    /// At home on the top edge (its top square against the bezel), or floating.
    pub docked: bool,
    /// Docked in a corner: -1 left, 1 right (flush with that side), 0 the middle.
    pub corner: f64,
}

/// What the page tells: it wants the mode (the window grows in place), the drop is drawn where
/// the island will be (the window moves), or the island is back home.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum IslandStageStep {
    Enter,
    Go,
    Done,
}

const OFF: u8 = 0;
/// Grown in place, waiting for the page's drop.
const READY: u8 = 1;
/// Covering the screen: the region is the page's.
const ON: u8 = 2;
static PHASE: AtomicU8 = AtomicU8::new(OFF);
/// Each `Enter` gets its number: a page that never says `Go` lets the window go back.
static TRY: AtomicU64 = AtomicU64::new(0);
const READY_LIMIT: Duration = Duration::from_secs(2);

/// Where the window was (physical), and the screen it covers.
struct Place {
    x: i32,
    y: i32,
    screen: Rect,
    /// Grown in place first (not when the grown window would have changed scale).
    grown: bool,
}
static PLACE: Mutex<Option<Place>> = Mutex::new(None);
/// Where the page draws: rectangles (x, y, width, height) in logical pixels of the stage.
static AREA: Mutex<Vec<[f64; 4]>> = Mutex::new(Vec::new());
/// At most this many rectangles (the page merges the others).
const MOST: usize = 24;

/// The mode holds the window (no gesture, no tuck, no other region).
pub fn active() -> bool {
    PHASE.load(Ordering::SeqCst) != OFF
}

/// The page's rectangles, in physical pixels of the window.
fn rects(scale: f64) -> Vec<(i32, i32, i32, i32)> {
    let px = |v: f64| (v * scale).round() as i32;
    AREA.lock()
        .unwrap_or_else(|e| e.into_inner())
        .iter()
        .map(|[x, y, w, h]| (px(*x), px(*y), px(*w).max(0), px(*h).max(0)))
        .collect()
}

/// The region while the window covers the screen, as one rectangle (for those who only know one:
/// all the page's rectangles).
pub fn area_region(scale: f64) -> Region {
    let all = rects(scale);
    let x0 = all.iter().map(|r| r.0).min().unwrap_or(0);
    let y0 = all.iter().map(|r| r.1).min().unwrap_or(0);
    let x1 = all.iter().map(|r| r.0 + r.2).max().unwrap_or(0);
    let y1 = all.iter().map(|r| r.1 + r.3).max().unwrap_or(0);
    Region {
        x: x0,
        y: y0,
        width: (x1 - x0).max(0),
        height: (y1 - y0).max(0),
        round: 0,
        outline: Vec::new(),
    }
}

/// True while the region is the page's (covering the screen).
pub fn covering() -> bool {
    PHASE.load(Ordering::SeqCst) == ON
}

/// The page draws elsewhere (rectangles in logical pixels of the stage): the region follows once
/// the window covers the screen.
pub fn area<R: Runtime>(app: &AppHandle<R>, list: Vec<[f64; 4]>) {
    if !active() {
        return;
    }
    let ok = |r: &[f64; 4]| r.iter().all(|v| v.is_finite()) && r[2] > 0.0 && r[3] > 0.0;
    let kept: Vec<[f64; 4]> = list.into_iter().filter(ok).take(MOST).collect();
    *AREA.lock().unwrap_or_else(|e| e.into_inner()) = kept;
    if !covering() {
        return;
    }
    if let Some(window) = windows::get(app, WIDGET) {
        if let Ok(h) = window.hwnd() {
            win::set_region_rects(h.0 as isize, &rects(window.scale_factor().unwrap_or(1.0)));
        }
    }
}

/// The page's step; `Enter` answers the stage when the island may go (none otherwise).
pub fn step<R: Runtime>(app: &AppHandle<R>, step: IslandStageStep) -> Option<IslandStage> {
    let window = windows::get(app, WIDGET)?;
    let raw = window.hwnd().ok()?.0 as isize;
    match step {
        IslandStageStep::Enter => enter(app, &window, raw),
        IslandStageStep::Go => {
            go(&window, raw);
            None
        }
        IslandStageStep::Done => {
            back(app, &window, raw);
            None
        }
    }
}

/// The screen covering most of `r` (Windows gives a window the scale of that one).
fn most_of<'a>(screens: &'a [Screen], r: &Rect) -> Option<&'a Screen> {
    let overlap = |s: &Screen| {
        let x = (i64::from(r.x) + i64::from(r.width))
            .min(i64::from(s.rect.x) + i64::from(s.rect.width))
            - i64::from(r.x).max(i64::from(s.rect.x));
        let y = (i64::from(r.y) + i64::from(r.height))
            .min(i64::from(s.rect.y) + i64::from(s.rect.height))
            - i64::from(r.y).max(i64::from(s.rect.y));
        x.max(0) * y.max(0)
    };
    screens.iter().max_by_key(|s| overlap(s))
}

fn enter<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    raw: isize,
) -> Option<IslandStage> {
    let busy = drive::running() || OPEN.load(Ordering::SeqCst) || tuck::tucked();
    if active() || busy || !window.is_visible().unwrap_or(false) {
        return None;
    }
    let screens = windows::screens(app);
    let (a, scale, i) = locate(window, &screens)?;
    let pos = window.outer_position().ok()?;
    let r = screens.get(i)?.rect;
    AREA.lock().unwrap_or_else(|e| e.into_inner()).clear();
    PHASE.store(READY, Ordering::SeqCst);
    // Grown in place: what the window shows does not move (unless the grown window would mostly
    // lie on a screen of another scale: Windows would rescale it; it then grows as it moves).
    let grown = Rect {
        x: pos.x,
        y: pos.y,
        width: r.width,
        height: r.height,
    };
    let same = most_of(&screens, &grown).is_none_or(|s| (s.scale - scale).abs() < 1e-3);
    *PLACE.lock().unwrap_or_else(|e| e.into_inner()) = Some(Place {
        x: pos.x,
        y: pos.y,
        screen: r,
        grown: same,
    });
    if same {
        win::place(raw, pos.x, pos.y, r.width as i32, r.height as i32);
    }
    let mine = TRY.fetch_add(1, Ordering::SeqCst) + 1;
    let app2 = app.clone();
    let _ = std::thread::Builder::new()
        .name("island-stage".into())
        .spawn(move || {
            std::thread::sleep(READY_LIMIT);
            if TRY.load(Ordering::SeqCst) == mine && PHASE.load(Ordering::SeqCst) == READY {
                tracing::warn!("island: the page never drew its drop, music mode given up");
                abort(&app2);
            }
        });
    let docked = is_docked();
    tracing::info!("island: music mode, the window grows");
    Some(IslandStage {
        on: true,
        width: f64::from(r.width) / scale,
        height: f64::from(r.height) / scale,
        home_x: (a.x - f64::from(r.x)) / scale,
        home_y: (a.y - f64::from(r.y)) / scale,
        docked,
        corner: if docked {
            slots::corner_of(slot_now())
        } else {
            0.0
        },
    })
}

/// The page has drawn the drop where the island will be: the window moves to the screen's corner
/// and shows the page's rectangles.
fn go<R: Runtime>(window: &WebviewWindow<R>, raw: isize) {
    if PHASE
        .compare_exchange(READY, ON, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }
    let place = PLACE.lock().unwrap_or_else(|e| e.into_inner());
    let Some(p) = place.as_ref() else { return };
    let scale = window.scale_factor().unwrap_or(1.0);
    let r = p.screen;
    win::set_region(raw, Some(tuck::nothing()));
    win::place(raw, r.x, r.y, r.width as i32, r.height as i32);
    win::set_region_rects(raw, &rects(scale));
    tracing::info!("island: music mode on");
}

/// Ends the mode at once (the island is being hidden): the window comes back home.
pub fn abort<R: Runtime>(app: &AppHandle<R>) {
    if !active() {
        return;
    }
    if let Some(window) = windows::get(app, WIDGET) {
        if let Ok(h) = window.hwnd() {
            back(app, &window, h.0 as isize);
        }
    }
}

/// The window back to its place (the page shows the island there), then to its size.
fn back<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, raw: isize) {
    if PHASE.swap(OFF, Ordering::SeqCst) == OFF {
        return;
    }
    let scale = window.scale_factor().unwrap_or(1.0);
    let place = PLACE.lock().unwrap_or_else(|e| e.into_inner()).take();
    if let Some(p) = place {
        let r = p.screen;
        let (w, h) = window_size(scale);
        win::set_region(raw, Some(tuck::nothing()));
        if p.grown {
            // Back at its place at the screen's size (the island shows there), then shrunk.
            win::place(raw, p.x, p.y, r.width as i32, r.height as i32);
            win::set_region(raw, Some(region_now(scale)));
            win::place(raw, p.x, p.y, w as i32, h as i32);
        } else {
            // Never grown in place (another scale there): straight back to its size.
            win::place(raw, p.x, p.y, w as i32, h as i32);
            win::set_region(raw, Some(region_now(scale)));
        }
    } else {
        win::set_region(raw, Some(region_now(scale)));
    }
    let off = IslandStage {
        on: false,
        width: 0.0,
        height: 0.0,
        home_x: 0.0,
        home_y: 0.0,
        docked: is_docked(),
        corner: 0.0,
    };
    crate::ipc::notify(off.emit(app));
    tracing::info!("island: music mode off");
}
