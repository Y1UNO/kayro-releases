//! The island window's click region (and what shows): the island at rest, the opened island, or
//! all of the window but its edges while it moves. Logical sizes, scaled for the window.

use std::sync::Mutex;

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
pub const OPEN_SIZE: (f64, f64) = (420.0, 180.0);
const OPEN_RADIUS: f64 = 28.0;

/// The island's largest size at rest as the page draws it now (wider with music or a launch,
/// taller on hover with the dots of the running apps), logical; the click region holds it.
static FOOTPRINT: Mutex<(f64, f64)> = Mutex::new((0.0, 0.0));
/// The footprint never goes past this (the window's room).
const FOOTPRINT_MAX: (f64, f64) = (360.0, 110.0);

pub fn set_footprint(width: f64, height: f64) {
    let ok = |v: f64, max: f64| {
        if v.is_finite() {
            v.clamp(0.0, max)
        } else {
            0.0
        }
    };
    *FOOTPRINT.lock().unwrap_or_else(|e| e.into_inner()) =
        (ok(width, FOOTPRINT_MAX.0), ok(height, FOOTPRINT_MAX.1));
}

/// `base` grown to the page's footprint.
fn hovered(base: (f64, f64)) -> (f64, f64) {
    let f = *FOOTPRINT.lock().unwrap_or_else(|e| e.into_inner());
    (base.0.max(f.0), base.1.max(f.1))
}

pub(super) fn physical(v: f64, scale: f64) -> i32 {
    (v * scale).round() as i32
}

/// The click region at rest: the island at its largest (hovered) with its shoulders, nothing
/// else; in a corner, nothing past the island's flush sides.
pub fn rest_region(docked: bool, slot: Slot, scale: f64) -> Region {
    let p = |v: f64| physical(v, scale);
    let (float_hover, docked_hover) = (hovered(FLOAT_HOVER), hovered(DOCKED_HOVER));
    if !docked {
        let half = float_hover.0 / 2.0 + SHADOW;
        let height = float_hover.1 + SHADOW * 2.0;
        return Region {
            x: p(ANCHOR.0 - half),
            y: p(ANCHOR.1 - SHADOW),
            width: p(half * 2.0),
            height: p(height),
            round: p(height),
        };
    }
    let base = slots::DOCKED_WIDTH / 2.0;
    let (left, right, height) = match slot {
        Slot::Center => (
            ANCHOR.0 - docked_hover.0 / 2.0 - SHOULDER,
            ANCHOR.0 + docked_hover.0 / 2.0 + SHOULDER,
            docked_hover.1,
        ),
        Slot::Left => (
            ANCHOR.0 - base,
            ANCHOR.0 - base + docked_hover.0 + SHOULDER,
            docked_hover.1 + SHOULDER,
        ),
        Slot::Right => (
            ANCHOR.0 + base - docked_hover.0 - SHOULDER,
            ANCHOR.0 + base,
            docked_hover.1 + SHOULDER,
        ),
    };
    Region {
        x: p(left),
        y: p(ANCHOR.1),
        width: p(right - left),
        height: p(height),
        round: 0,
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
    }
}

/// The click region of the opened island (its panel, with its shoulders or its shadow).
pub fn open_region(docked: bool, slot: Slot, scale: f64) -> Region {
    let p = |v: f64| physical(v, scale);
    let (w, h) = OPEN_SIZE;
    if !docked {
        let half = w / 2.0 + SHADOW;
        return Region {
            x: p(ANCHOR.0 - half),
            y: p(ANCHOR.1 - SHADOW),
            width: p(half * 2.0),
            height: p(h + SHADOW * 2.0),
            round: p((OPEN_RADIUS + SHADOW) * 2.0),
        };
    }
    let base = slots::DOCKED_WIDTH / 2.0;
    let (left, right, height) = match slot {
        Slot::Center => (
            ANCHOR.0 - w / 2.0 - SHOULDER,
            ANCHOR.0 + w / 2.0 + SHOULDER,
            h,
        ),
        Slot::Left => (
            ANCHOR.0 - base,
            ANCHOR.0 - base + w + SHOULDER,
            h + SHOULDER,
        ),
        Slot::Right => (
            ANCHOR.0 + base - w - SHOULDER,
            ANCHOR.0 + base,
            h + SHOULDER,
        ),
    };
    Region {
        x: p(left),
        y: p(ANCHOR.1),
        width: p(right - left),
        height: p(height),
        round: 0,
    }
}
