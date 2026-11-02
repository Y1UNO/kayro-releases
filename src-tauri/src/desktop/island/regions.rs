//! The island window's click region (and what shows): the island at rest, the opened island, or
//! all of the window but its edges while it moves. Logical sizes, scaled for the window.

use std::sync::Mutex;

use super::outline::docked_outline;
use super::slots::{self, Slot};
use super::{window_size, ANCHOR};
use crate::platform::island::Region;

/// The docked island when hovered (its largest), and its shoulders (curves into the bezels).
pub(super) const DOCKED_HOVER: (f64, f64) = (204.0, 36.0);
pub(super) const SHOULDER: f64 = 10.0;
/// The floating island when hovered, and the room left for its rim's glow and shadow.
pub(super) const FLOAT_HOVER: (f64, f64) = (190.0, 48.0);
pub(super) const SHADOW: f64 = 16.0;
/// The opened island: its size and its corners (page: islandShape.ts `OPEN`).
/// The opened island's size follows its content (the page's `panelSize`), within these bounds.
const OPEN_MIN: (f64, f64) = (240.0, 60.0);
const OPEN_MAX: (f64, f64) = (420.0, 200.0);
static OPEN_SIZE: Mutex<(f64, f64)> = Mutex::new((360.0, 148.0));

/// The opened island's size now (logical).
pub fn open_size() -> (f64, f64) {
    *OPEN_SIZE.lock().unwrap_or_else(|e| e.into_inner())
}

pub fn set_open_size(width: f64, height: f64) {
    let ok = |v: f64, lo: f64, hi: f64| if v.is_finite() { v.clamp(lo, hi) } else { hi };
    *OPEN_SIZE.lock().unwrap_or_else(|e| e.into_inner()) = (
        ok(width, OPEN_MIN.0, OPEN_MAX.0),
        ok(height, OPEN_MIN.1, OPEN_MAX.1),
    );
}
const OPEN_RADIUS: f64 = 28.0;

/// The island's size at rest as the page draws it now (logical), docked and floating: wider
/// with music or a launch, taller hovered with the running apps' dots, a little bigger with the
/// music's breath. The click region holds it, no more (clicks next to it reach the windows below).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Footprint {
    pub docked: (f64, f64),
    pub floating: (f64, f64),
}

/// Until the page says: the hovered island.
static FOOTPRINT: Mutex<Footprint> = Mutex::new(Footprint {
    docked: DOCKED_HOVER,
    floating: FLOAT_HOVER,
});
/// The island at rest is never smaller (islandShape.ts `DOCKED`, `FLOATING`), never larger (the
/// window's room: music, a launch and a hover at once).
const DOCKED_MIN: (f64, f64) = (184.0, 32.0);
const FLOAT_MIN: (f64, f64) = (176.0, 44.0);
const FOOTPRINT_MAX: (f64, f64) = (420.0, 110.0);
/// Floating, what its shadow reaches (Island.module.css: `0 4px 10px`): above, on the sides,
/// below. It is also the margin that forgives a click a little off.
const FLOAT_PAD: (f64, f64, f64) = (6.0, 10.0, 14.0);

pub fn set_footprint(docked: (f64, f64), floating: (f64, f64)) {
    let ok = |v: f64, min: f64, max: f64| {
        if v.is_finite() {
            v.clamp(min, max)
        } else {
            max
        }
    };
    let size = |(w, h): (f64, f64), min: (f64, f64)| {
        (ok(w, min.0, FOOTPRINT_MAX.0), ok(h, min.1, FOOTPRINT_MAX.1))
    };
    *FOOTPRINT.lock().unwrap_or_else(|e| e.into_inner()) = Footprint {
        docked: size(docked, DOCKED_MIN),
        floating: size(floating, FLOAT_MIN),
    };
}

pub(super) fn physical(v: f64, scale: f64) -> i32 {
    (v * scale).round() as i32
}

/// The click region at rest: the island as the page draws it now with its shoulders (or its
/// shadow) and a small margin, nothing else; in a corner, nothing past the island's flush sides.
pub fn rest_region(docked: bool, slot: Slot, scale: f64) -> Region {
    let f = *FOOTPRINT.lock().unwrap_or_else(|e| e.into_inner());
    rest_region_for(f, docked, slot, scale)
}

pub(super) fn rest_region_for(f: Footprint, docked: bool, slot: Slot, scale: f64) -> Region {
    let p = |v: f64| physical(v, scale);
    if !docked {
        let (w, h) = f.floating;
        let (top, side, bottom) = FLOAT_PAD;
        let height = h + top + bottom;
        return Region {
            x: p(ANCHOR.0 - w / 2.0 - side),
            y: p(ANCHOR.1 - top),
            width: p(w + side * 2.0),
            height: p(height),
            round: p(height),
            outline: Vec::new(),
        };
    }
    let (w, h) = f.docked;
    // Its bottom is a capsule's (islandShape.ts: `min(width, height) / 2`).
    docked_region((w, h), h.min(w) / 2.0, slot, scale)
}

/// The docked island `size` (logical) in `slot`, its bottom corners rounded by `radius`: its exact
/// outline with its shoulders (outline.rs), scaled for the window.
fn docked_region(size: (f64, f64), radius: f64, slot: Slot, scale: f64) -> Region {
    let base = slots::DOCKED_WIDTH / 2.0;
    let left = match slot {
        Slot::Center => ANCHOR.0 - size.0 / 2.0,
        Slot::Left => ANCHOR.0 - base,
        Slot::Right => ANCHOR.0 + base - size.0,
    };
    let mut outline: Vec<(i32, i32)> = docked_outline(left, ANCHOR.1, size, radius, SHOULDER, slot)
        .into_iter()
        .map(|(x, y)| (physical(x, scale), physical(y, scale)))
        .collect();
    outline.dedup();
    let xs = outline.iter().map(|p| p.0);
    let ys = outline.iter().map(|p| p.1);
    let (x0, x1) = (xs.clone().min().unwrap_or(0), xs.max().unwrap_or(0));
    let (y0, y1) = (ys.clone().min().unwrap_or(0), ys.max().unwrap_or(0));
    Region {
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0,
        round: 0,
        outline,
    }
}

/// While the island moves: all of the window but a thin border (the edges never show anything).
pub fn moving_region(scale: f64) -> Region {
    let (w, h) = window_size(scale);
    Region {
        x: 2,
        y: 2,
        width: w as i32 - 4,
        height: h as i32 - 4,
        round: 0,
        outline: Vec::new(),
    }
}

/// The click region of the opened island (its panel, with its shoulders or its shadow).
pub fn open_region(docked: bool, slot: Slot, scale: f64) -> Region {
    let p = |v: f64| physical(v, scale);
    let (w, h) = open_size();
    if !docked {
        let half = w / 2.0 + SHADOW;
        return Region {
            x: p(ANCHOR.0 - half),
            y: p(ANCHOR.1 - SHADOW),
            width: p(half * 2.0),
            height: p(h + SHADOW * 2.0),
            round: p((OPEN_RADIUS + SHADOW) * 2.0),
            outline: Vec::new(),
        };
    }
    docked_region((w, h), OPEN_RADIUS, slot, scale)
}
