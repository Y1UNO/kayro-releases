//! Where a docked island sits on a screen's top edge: centred (the notch), or flush in either
//! top corner (against the top and the side bezels). Pure, in physical pixels; each screen's
//! own scale turns the logical sizes into pixels.

pub use crate::config::ui_state::DockSlot as Slot;
use crate::config::ui_state::Rect;
use crate::desktop::geometry::Screen;

use super::physics::{FLOAT_SIZE, V2};

/// The docked island's width (logical): the notch and the corner pieces alike.
pub const DOCKED_WIDTH: f64 = 184.0;
/// Within this distance of a corner's place, the notch turns into the corner piece.
pub const CORNER_ZONE: f64 = 140.0;

/// The top edge an island docks to: the screen's, unless the taskbar sits there.
pub fn dock_top(s: &Screen) -> f64 {
    f64::from(s.work.y.max(s.rect.y))
}

/// The docked anchor (centre of the island's top edge) of a slot.
pub fn slot_anchor(s: &Screen, slot: Slot) -> V2 {
    let half = DOCKED_WIDTH * s.scale / 2.0;
    let left = f64::from(s.work.x);
    let right = left + f64::from(s.work.width);
    let x = match slot {
        Slot::Left => left + half,
        Slot::Center => f64::from(s.rect.x) + f64::from(s.rect.width) / 2.0,
        Slot::Right => right - half,
    };
    V2::new(x, dock_top(s))
}

/// The slot closest to `x` (the screen split in three around its centre).
pub fn nearest_slot(s: &Screen, x: f64) -> Slot {
    [Slot::Left, Slot::Center, Slot::Right]
        .into_iter()
        .min_by(|a, b| {
            let da = (slot_anchor(s, *a).x - x).abs();
            let db = (slot_anchor(s, *b).x - x).abs();
            da.total_cmp(&db)
        })
        .unwrap_or(Slot::Center)
}

/// -1 (left corner) … 0 (anywhere else) … 1 (right corner): how far a docked island at `x` has
/// turned into a corner piece.
pub fn corner_at(s: &Screen, x: f64) -> f64 {
    let zone = CORNER_ZONE * s.scale;
    let left = (1.0 - (x - slot_anchor(s, Slot::Left).x) / zone).clamp(0.0, 1.0);
    let right = (1.0 - (slot_anchor(s, Slot::Right).x - x) / zone).clamp(0.0, 1.0);
    right - left
}

/// The page's number for a slot (-1, 0, 1).
pub fn corner_of(slot: Slot) -> f64 {
    match slot {
        Slot::Left => -1.0,
        Slot::Center => 0.0,
        Slot::Right => 1.0,
    }
}

fn contains(r: &Rect, p: V2) -> bool {
    p.x >= f64::from(r.x)
        && p.x < f64::from(r.x) + f64::from(r.width)
        && p.y >= f64::from(r.y)
        && p.y < f64::from(r.y) + f64::from(r.height)
}

/// Keeps the floating island (anchor `a`) inside `work`.
pub fn clamp_anchor(a: V2, work: &Rect, scale: f64) -> V2 {
    let (w, h) = (FLOAT_SIZE.0 * scale, FLOAT_SIZE.1 * scale);
    let (x0, y0) = (f64::from(work.x) + w / 2.0, f64::from(work.y));
    let x1 = (f64::from(work.x) + f64::from(work.width) - w / 2.0).max(x0);
    let y1 = (f64::from(work.y) + f64::from(work.height) - h).max(y0);
    V2::new(a.x.clamp(x0, x1), a.y.clamp(y0, y1))
}

/// The screen whose rectangle holds the island's centre (anchor `a`).
pub fn screen_of(screens: &[Screen], a: V2, scale: f64) -> Option<usize> {
    let centre = V2::new(a.x, a.y + FLOAT_SIZE.1 * scale / 2.0);
    screens.iter().position(|s| contains(&s.rect, centre))
}

/// Which sides of screen `i` (left, right, top, bottom) touch another screen.
pub fn shared_sides(screens: &[Screen], i: usize) -> [bool; 4] {
    const SLACK: i64 = 2;
    let bounds = |r: &Rect| {
        let (x, y) = (i64::from(r.x), i64::from(r.y));
        (x, x + i64::from(r.width), y, y + i64::from(r.height))
    };
    let mut out = [false; 4];
    let Some(home) = screens.get(i) else {
        return out;
    };
    let (l, r, t, b) = bounds(&home.rect);
    for (j, other) in screens.iter().enumerate() {
        if j == i {
            continue;
        }
        let (nl, nr, nt, nb) = bounds(&other.rect);
        let beside = nt < b && nb > t;
        let above_below = nl < r && nr > l;
        out[0] |= beside && (nr - l).abs() <= SLACK;
        out[1] |= beside && (nl - r).abs() <= SLACK;
        out[2] |= above_below && (nb - t).abs() <= SLACK;
        out[3] |= above_below && (nt - b).abs() <= SLACK;
    }
    out
}

/// « Glitch » passage: the floating island kept on screen `i` except on the sides it shares with
/// another screen, where nothing holds it back (it may sit across both).
pub fn clamp_on_desk(a: V2, screens: &[Screen], i: usize, scale: f64) -> V2 {
    let inner = clamp_anchor(a, &screens[i].work, scale);
    let [l, r, t, b] = shared_sides(screens, i);
    let x = if (l && a.x < inner.x) || (r && a.x > inner.x) {
        a.x
    } else {
        inner.x
    };
    let y = if (t && a.y < inner.y) || (b && a.y > inner.y) {
        a.y
    } else {
        inner.y
    };
    V2::new(x, y)
}

/// The edge between two screens that cuts through the floating island anchored at `a` on screen
/// `i`, if any: a vertical one (its x) and a horizontal one (its y), physical pixels.
pub fn seam_of(screens: &[Screen], i: usize, a: V2, scale: f64) -> (Option<f64>, Option<f64>) {
    let Some(home) = screens.get(i) else {
        return (None, None);
    };
    let m = &home.rect;
    let [l, r, t, b] = shared_sides(screens, i);
    let (w, h) = (FLOAT_SIZE.0 * scale, FLOAT_SIZE.1 * scale);
    let (left, right) = (f64::from(m.x), f64::from(m.x) + f64::from(m.width));
    let (top, bottom) = (f64::from(m.y), f64::from(m.y) + f64::from(m.height));
    let x = if l && a.x - w / 2.0 < left {
        Some(left)
    } else if r && a.x + w / 2.0 > right {
        Some(right)
    } else {
        None
    };
    let y = if t && a.y < top {
        Some(top)
    } else if b && a.y + h > bottom {
        Some(bottom)
    } else {
        None
    };
    (x, y)
}
