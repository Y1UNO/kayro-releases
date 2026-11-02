//! « Cacher l'île » (2026-11-02). Docked and left alone, the island goes into the top edge (the
//! page draws it going, `islandTuck.ts`); once in, its window has an empty region: nothing shows,
//! no click is taken. Only then a thread reads the cursor (`GetCursorPos`: no input is caught or
//! held back), 10 times a second, 60 near the top of the island's place. Held on the very top row
//! of the screen there for `island_peek_delay`, the island's region comes back and the page
//! brings it out. The thread ends as soon as the island is out or hidden, or its window is gone.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime};
use tauri_specta::Event;

use super::slots::{slot_anchor, Slot, DOCKED_WIDTH};
use super::{drive, is_docked, locate, slot_now, win, Region, OPEN};
use crate::desktop::geometry::Screen;
use crate::desktop::windows::{self, WIDGET};

/// The core brought the island out of the top edge (the cursor touched the top of its place).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct IslandTucked {
    pub tucked: bool,
}

/// In the top edge: its window shows nothing.
static TUCKED: AtomicBool = AtomicBool::new(false);
/// The watch running; a newer one (or `reset`) ends the older thread.
static WATCH: AtomicU64 = AtomicU64::new(0);

/// Room on each side of the island's place, and how near the top the cursor is read often
/// (logical pixels).
const MARGIN: f64 = 24.0;
const NEAR: f64 = 32.0;
const SLOW: Duration = Duration::from_millis(100);
const FAST: Duration = Duration::from_millis(16);

pub fn tucked() -> bool {
    TUCKED.load(Ordering::SeqCst)
}

/// Nothing shows, no click is taken.
pub fn nothing() -> Region {
    Region {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        round: 0,
        outline: Vec::new(),
    }
}

/// The island's window is shown or hidden again: out of the edge, the watch over (whoever shows
/// the window gives it its region).
pub fn reset() {
    TUCKED.store(false, Ordering::SeqCst);
    WATCH.fetch_add(1, Ordering::SeqCst);
}

/// The top row of a screen that brings the island out: `left..right` on row `top` (physical).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Zone {
    pub left: f64,
    pub right: f64,
    pub top: i32,
    near: f64,
}

impl Zone {
    /// The place of an island docked in `slot` on `screen`, `width` (logical) wide at rest, and a
    /// margin on each side; in a corner, up to the screen's side.
    pub fn of(screen: &Screen, slot: Slot, width: f64) -> Self {
        let s = screen.scale;
        let (w, m) = (width.max(DOCKED_WIDTH) * s, MARGIN * s);
        let edge_l = f64::from(screen.rect.x);
        let edge_r = edge_l + f64::from(screen.rect.width);
        let work_l = f64::from(screen.work.x);
        let work_r = work_l + f64::from(screen.work.width);
        let (left, right) = match slot {
            Slot::Left => (edge_l, work_l + w + m),
            Slot::Right => (work_r - w - m, edge_r),
            Slot::Center => {
                let x = slot_anchor(screen, slot).x;
                (x - w / 2.0 - m, x + w / 2.0 + m)
            }
        };
        Self {
            left: left.max(edge_l),
            right: right.min(edge_r),
            top: screen.rect.y,
            near: NEAR * s,
        }
    }

    /// The cursor is on the very top row of the screen, in the island's place.
    pub fn touched(&self, (x, y): (i32, i32)) -> bool {
        y == self.top && self.across(x)
    }

    /// Near enough the top of the place to be read often.
    pub fn close(&self, (x, y): (i32, i32)) -> bool {
        y >= self.top && f64::from(y - self.top) < self.near && self.across(x)
    }

    fn across(&self, x: i32) -> bool {
        let x = f64::from(x);
        x >= self.left && x < self.right
    }
}

/// The page's island went into the top edge (`tucked`; `width`: its width at rest, logical) or
/// comes out by itself. False when it cannot stay in (floating, opened, moving, not on screen):
/// the page brings it out again.
pub fn set<R: Runtime>(app: &AppHandle<R>, tucked: bool, width: f64) -> bool {
    let Some(window) = windows::get(app, WIDGET) else {
        reset();
        return false;
    };
    let Ok(h) = window.hwnd() else { return false };
    let raw = h.0 as isize;
    let scale = window.scale_factor().unwrap_or(1.0);
    if !tucked {
        let was = TUCKED.load(Ordering::SeqCst);
        reset();
        if was && !drive::running() {
            win::set_region(raw, Some(super::region_now(scale)));
        }
        return true;
    }
    let free = is_docked() && !OPEN.load(Ordering::SeqCst) && !drive::running();
    if !free || !window.is_visible().unwrap_or(false) {
        return false;
    }
    let screens = windows::screens(app);
    let Some((_, scale, i)) = locate(&window, &screens) else {
        return false;
    };
    let zone = Zone::of(&screens[i], slot_now(), width);
    let hold = super::super::settings(app)
        .island_peek_delay
        .clamp(0.0, 1.0);
    TUCKED.store(true, Ordering::SeqCst);
    win::set_region(raw, Some(nothing()));
    watch(app.clone(), raw, zone, scale, Duration::from_secs_f32(hold));
    true
}

/// Reads the cursor until it has stayed `hold` on the top of `zone` (then the island comes out),
/// or the island is out of the edge some other way.
fn watch<R: Runtime>(app: AppHandle<R>, raw: isize, zone: Zone, scale: f64, hold: Duration) {
    let mine = WATCH.fetch_add(1, Ordering::SeqCst) + 1;
    let thread = app.clone();
    let spawned = std::thread::Builder::new()
        .name("island-tuck".into())
        .spawn(move || {
            let mut since: Option<Instant> = None;
            while WATCH.load(Ordering::SeqCst) == mine && tucked() && win::alive(raw) {
                let at = win::cursor();
                let touched = at.is_some_and(|p| zone.touched(p));
                if touched {
                    if since.get_or_insert_with(Instant::now).elapsed() >= hold {
                        come_out(&thread, raw, mine, scale);
                        return;
                    }
                } else {
                    since = None;
                }
                let close = touched || at.is_some_and(|p| zone.close(p));
                std::thread::sleep(if close { FAST } else { SLOW });
            }
        });
    if let Err(e) = spawned {
        tracing::warn!(error = %e, "island: no thread to watch the top edge, it stays out");
        come_out(&app, raw, mine, scale);
    }
}

/// Out of the edge: the island's region first, then the page draws it coming out.
fn come_out<R: Runtime>(app: &AppHandle<R>, raw: isize, mine: u64, scale: f64) {
    if WATCH.load(Ordering::SeqCst) != mine || !TUCKED.swap(false, Ordering::SeqCst) {
        return;
    }
    win::set_region(raw, Some(super::region_now(scale)));
    crate::ipc::notify(IslandTucked { tucked: false }.emit(app));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ui_state::Rect;

    fn screen(x: i32, scale: f64) -> Screen {
        let rect = Rect {
            x,
            y: 0,
            width: 2560,
            height: 1440,
        };
        let work = Rect {
            height: 1392,
            ..rect
        };
        Screen {
            name: None,
            rect,
            work,
            scale,
        }
    }

    #[test]
    fn only_the_very_top_row_of_the_place_brings_it_out() {
        let z = Zone::of(&screen(0, 1.0), Slot::Center, 184.0);
        // 1280 ± 92 ± 24.
        assert_eq!((z.left, z.right), (1164.0, 1396.0));
        assert!(z.touched((1280, 0)));
        assert!(z.touched((1165, 0)) && z.touched((1395, 0)));
        assert!(!z.touched((1280, 1)), "one pixel below: a browser's tabs");
        assert!(!z.touched((1100, 0)), "beside the place");
        assert!(z.close((1280, 20)) && !z.close((1280, 40)));
    }

    #[test]
    fn a_wider_island_and_the_scale_widen_the_place() {
        let z = Zone::of(&screen(0, 1.5), Slot::Center, 228.0);
        let half = (228.0 / 2.0 + 24.0) * 1.5;
        assert_eq!((z.left, z.right), (1280.0 - half, 1280.0 + half));
        assert!(z.close((1280, 47)) && !z.close((1280, 48)));
        // Never narrower than the docked island.
        let narrow = Zone::of(&screen(0, 1.0), Slot::Center, 40.0);
        assert_eq!(narrow.left, 1164.0);
    }

    #[test]
    fn in_a_corner_the_place_goes_to_the_side_of_the_screen() {
        let s = screen(-2560, 1.0);
        let left = Zone::of(&s, Slot::Left, 184.0);
        assert_eq!((left.left, left.right), (-2560.0, -2560.0 + 184.0 + 24.0));
        let right = Zone::of(&s, Slot::Right, 184.0);
        assert_eq!((right.left, right.right), (-208.0, 0.0));
        assert!(
            right.touched((-1, 0)) && !right.touched((0, 0)),
            "the next screen's"
        );
    }
}
