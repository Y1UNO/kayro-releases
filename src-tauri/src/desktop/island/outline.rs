//! The docked island's outline, for its click region (2026-11-02: « une hitbox vraiment
//! précise »): its square top on the bezel, its rounded bottom corners and its shoulders (the
//! curves into the bezels), as the page draws them (Island.module.css). Nothing around it takes a
//! click: the empty corners beside its rounded bottom reach the windows below.

use super::slots::Slot;

/// Segments per quarter circle: under half a pixel off at these sizes.
const STEPS: usize = 8;
/// Around the island (not on a bezel): its anti-aliased edge, and a click barely off.
pub(super) const EDGE: f64 = 1.0;

/// The outline of the docked island (logical, window coordinates, clockwise): `left` and `top`
/// its corner, `size` its width and height, `radius` its bottom corners, `shoulder` its curves.
/// In a corner slot, its flush side has no margin, no rounding, and its shoulder below it.
pub(super) fn docked_outline(
    left: f64,
    top: f64,
    (w, h): (f64, f64),
    radius: f64,
    shoulder: f64,
    slot: Slot,
) -> Vec<(f64, f64)> {
    let s = shoulder;
    let l = if slot == Slot::Left {
        left
    } else {
        left - EDGE
    };
    let r = if slot == Slot::Right {
        left + w
    } else {
        left + w + EDGE
    };
    let b = top + h + EDGE;
    let rad = (radius + EDGE)
        .min((b - top) / 2.0)
        .min((r - l) / 2.0)
        .max(0.0);
    let mut pts = Vec::with_capacity(4 * (STEPS + 1));
    // Along the top to the right, then down: the top-right shoulder, or the flush side.
    if slot == Slot::Right {
        pts.push((r, top));
        // Down the bezel, then the shoulder below the island curves back to its bottom.
        arc(&mut pts, (r - s, b + s), s, 0.0, -90.0);
    } else {
        arc(&mut pts, (r + s, top + s), s, 270.0, 180.0);
        arc(&mut pts, (r - rad, b - rad), rad, 0.0, 90.0);
    }
    // Along the bottom to the left, then up.
    if slot == Slot::Left {
        arc(&mut pts, (l + s, b + s), s, 270.0, 180.0);
        pts.push((l, top));
    } else {
        arc(&mut pts, (l + rad, b - rad), rad, 90.0, 180.0);
        arc(&mut pts, (l - s, top + s), s, 360.0, 270.0);
    }
    pts.dedup();
    pts
}

/// A quarter circle around `c`, from angle `from` to `to` (degrees, y down).
fn arc(pts: &mut Vec<(f64, f64)>, c: (f64, f64), rad: f64, from: f64, to: f64) {
    for i in 0..=STEPS {
        let a = (from + (to - from) * i as f64 / STEPS as f64).to_radians();
        pts.push((c.0 + rad * a.cos(), c.1 + rad * a.sin()));
    }
}

/// Whether `p` is inside the outline `pts` (even-odd): for the tests.
#[cfg(test)]
pub(super) fn inside(pts: &[(i32, i32)], p: (f64, f64)) -> bool {
    let mut odd = false;
    let n = pts.len();
    for i in 0..n {
        let (a, c) = (pts[i], pts[(i + n - 1) % n]);
        let (ax, ay, cx, cy) = (a.0 as f64, a.1 as f64, c.0 as f64, c.1 as f64);
        if (ay > p.1) != (cy > p.1) && p.0 < (cx - ax) * (p.1 - ay) / (cy - ay) + ax {
            odd = !odd;
        }
    }
    odd
}
