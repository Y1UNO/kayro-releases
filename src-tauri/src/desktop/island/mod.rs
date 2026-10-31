//! Step 20 (Kysland): the widget is an island. Docked, it is a black notch against the top edge
//! of a screen (it melts into the bezel, best on OLED), centred or slid into a top corner (flush
//! with both bezels); torn off with a pull, it floats where it is put, on any screen (forced
//! through the edge between two screens); let go near a top edge, it docks again. The window
//! never changes size: it is a transparent stage (`WINDOW`) whose **click region** is cut to the
//! island at rest, so clicks next to it reach the windows below.
//!
//! A gesture is driven here, not by the page: a thread steps the physics (`physics.rs`) on the
//! composition's beat and moves the window, only from the press until the island is at rest. The
//! page draws the island from `IslandFrame` (each frame of a gesture) and `IslandMoment`.

mod backdrop;
mod drive;
pub mod effects;
mod presence;
pub mod physics;
mod raster;
mod regions;
pub mod slots;
mod springs;

use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime, WebviewWindow};
use tauri_specta::Event;

use super::geometry::Screen;
use super::windows::{self, WIDGET};
use crate::config::ui_state::{Placement, Rect};
use crate::config::ConfigState;
use crate::platform::island::{self as win, Region};
pub use backdrop::{backdrop_at, backdrop_now};
pub use presence::{on_foreground, page_ready, quiet, sync};
use physics::V2;
use regions::physical;
pub use regions::{moving_region, open_region, rest_region};
use slots::Slot;

/// The window, in logical pixels: the island plus room for its stretches and bubbles.
pub const WINDOW: (f64, f64) = (720.0, 420.0);
/// Where the island's anchor (centre of its top edge) sits in the window.
pub const ANCHOR: (f64, f64) = (360.0, 150.0);

/// One frame of a gesture, for the page (logical pixels).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct IslandFrame {
    pub holding: bool,
    pub vx: f64,
    pub vy: f64,
    pub pull_x: f64,
    pub pull_y: f64,
    pub tension: f64,
    pub near: f64,
    /// -1 (left corner) … 1 (right corner).
    pub corner: f64,
    /// The window's position (physical pixels) and scale: bubbles stay where they were born.
    pub x: i32,
    pub y: i32,
    pub scale: f64,
    /// The island's screen, as insets of the window (logical): nothing of it is drawn past them.
    pub clip: [f64; 4],
    /// « Glitch »: the edge between two screens cutting through the island, in the window
    /// (logical): a vertical one's x, a horizontal one's y.
    pub seam_x: Option<f64>,
    pub seam_y: Option<f64>,
    /// The lightness behind the island (0–1), when it was just measured.
    pub backdrop: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum IslandMomentKind {
    Detached,
    Crossed,
    Docking,
    Touched,
    Snapped,
    Dropped,
    Tap,
    Settled,
}

/// A moment of a gesture; `dirX`/`dirY` for a crossing, `docked` and `corner` once at rest.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct IslandMoment {
    pub kind: IslandMomentKind,
    pub dir_x: f64,
    pub dir_y: f64,
    pub docked: bool,
    pub corner: f64,
}

/// Where the island is, for the page's first frame.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct IslandState {
    pub docked: bool,
    pub corner: f64,
    /// Floating across two screens: the edge between them, in the window (logical), as in
    /// `IslandFrame` (the « Glitch » goes on from the first frame).
    pub seam_x: Option<f64>,
    pub seam_y: Option<f64>,
}

/// Hidden because a program in full screen is in front on its screen.
static DUCKED: AtomicBool = AtomicBool::new(false);
/// On the top edge right now, and where (a gesture changes them before they are remembered).
static DOCKED_NOW: AtomicBool = AtomicBool::new(true);
static SLOT_NOW: AtomicU8 = AtomicU8::new(1);
/// Opened (its panel shows): no gesture starts, and the window keeps the panel's region.
static OPEN: AtomicBool = AtomicBool::new(false);

fn is_docked() -> bool {
    DOCKED_NOW.load(Ordering::SeqCst)
}

fn slot_now() -> Slot {
    match SLOT_NOW.load(Ordering::SeqCst) {
        0 => Slot::Left,
        2 => Slot::Right,
        _ => Slot::Center,
    }
}

fn set_place(docked: bool, slot: Slot) {
    DOCKED_NOW.store(docked, Ordering::SeqCst);
    let n = match slot {
        Slot::Left => 0,
        Slot::Center => 1,
        Slot::Right => 2,
    };
    SLOT_NOW.store(n, Ordering::SeqCst);
}

/// The window's size on a screen of this scale.
pub fn window_size(scale: f64) -> (u32, u32) {
    (
        physical(WINDOW.0, scale) as u32,
        physical(WINDOW.1, scale) as u32,
    )
}

/// The window's top-left corner for an island anchored at `a`.
pub fn window_at(a: V2, scale: f64) -> (i32, i32) {
    (
        (a.x - ANCHOR.0 * scale).round() as i32,
        (a.y - ANCHOR.1 * scale).round() as i32,
    )
}

/// Where the island starts: docked in its place on `screen`, or floating where it was left (if
/// that is still on a screen and the window has the same size, else docked).
pub fn start_rect(
    saved: &Placement,
    docked: bool,
    slot: Slot,
    screen: &Screen,
    screens: &[Screen],
) -> Rect {
    let s = screen.scale;
    let (width, height) = window_size(s);
    let floating = saved
        .rect
        .filter(|r| !docked && (r.width, r.height) == (width, height))
        .and_then(|r| {
            let a = V2::new(f64::from(r.x) + ANCHOR.0 * s, f64::from(r.y) + ANCHOR.1 * s);
            let i = physics::screen_of(screens, a, s)?;
            Some(slots::clamp_on_desk(a, screens, i, s))
        });
    let a = floating.unwrap_or_else(|| slots::slot_anchor(screen, slot));
    let (x, y) = window_at(a, s);
    Rect {
        x,
        y,
        width,
        height,
    }
}

/// Cuts a new island window to its shape at rest (before it is shown): no frame of Windows'
/// own around it (border, rounded corners), clicks only on the island.
pub fn shape<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let ui = app.state::<ConfigState>().ui_state();
    set_place(ui.widget_docked, ui.widget_slot);
    OPEN.store(false, Ordering::SeqCst);
    if let Ok(h) = window.hwnd() {
        let raw = h.0 as isize;
        let scale = window.scale_factor().unwrap_or(1.0);
        win::plain_frame(raw);
        win::set_region(raw, Some(rest_region(is_docked(), slot_now(), scale)));
    }
}

/// Where the island is (the page's first frame).
pub fn state_now<R: Runtime>(app: &AppHandle<R>) -> IslandState {
    let mut seam = (None, None);
    if let Some(window) = windows::get(app, WIDGET).filter(|_| !is_docked()) {
        let screens = windows::screens(app);
        if let (Some((a, scale, i)), Ok(pos)) = (locate(&window, &screens), window.outer_position())
        {
            let (x, y) = slots::seam_of(&screens, i, a, scale);
            seam = (
                x.map(|v| (v - f64::from(pos.x)) / scale),
                y.map(|v| (v - f64::from(pos.y)) / scale),
            );
        }
    }
    IslandState {
        docked: is_docked(),
        corner: if is_docked() {
            slots::corner_of(slot_now())
        } else {
            0.0
        },
        seam_x: seam.0,
        seam_y: seam.1,
    }
}

/// The island's anchor now, its scale and its screen.
fn locate<R: Runtime>(window: &WebviewWindow<R>, screens: &[Screen]) -> Option<(V2, f64, usize)> {
    let pos = window.outer_position().ok()?;
    let scale = window.scale_factor().unwrap_or(1.0);
    let a = V2::new(
        f64::from(pos.x) + ANCHOR.0 * scale,
        f64::from(pos.y) + ANCHOR.1 * scale,
    );
    let i = physics::screen_of(screens, a, scale).unwrap_or(0);
    Some((a, scale, i))
}

/// The page felt a press on the island: the gesture starts (`calm`: « reduce motion »).
pub fn grab<R: Runtime>(app: &AppHandle<R>, calm: bool) {
    let Some(window) = windows::get(app, WIDGET) else {
        return;
    };
    let screens = windows::screens(app);
    let (Ok(h), Some((anchor, scale, screen)), Some(cursor)) =
        (window.hwnd(), locate(&window, &screens), win::cursor())
    else {
        return;
    };
    if OPEN.load(Ordering::SeqCst) {
        return;
    }
    let cursor = V2::new(f64::from(cursor.0), f64::from(cursor.1));
    let passage = super::settings(app).island_passage;
    let (docked, slot) = (is_docked(), slot_now());
    let gesture = physics::Gesture::new(anchor, cursor, docked, slot, screen, scale, calm, passage);
    drive::start(app.clone(), h.0 as isize, screens, gesture, scale);
}

/// The region the window has at rest now: the opened island's panel, or the island.
fn region_now(scale: f64) -> Region {
    if OPEN.load(Ordering::SeqCst) {
        open_region(is_docked(), slot_now(), scale)
    } else {
        rest_region(is_docked(), slot_now(), scale)
    }
}

/// Where a floating island goes so that, opened, its panel fits in `work`.
pub fn fit_open(a: V2, work: &Rect, scale: f64) -> V2 {
    let (w, h) = (regions::OPEN_SIZE.0 * scale, regions::OPEN_SIZE.1 * scale);
    let x0 = f64::from(work.x) + w / 2.0;
    let x1 = (f64::from(work.x) + f64::from(work.width) - w / 2.0).max(x0);
    let y0 = f64::from(work.y);
    let y1 = (f64::from(work.y) + f64::from(work.height) - h).max(y0);
    V2::new(a.x.clamp(x0, x1), a.y.clamp(y0, y1))
}

/// The page opens or closes the island (its panel). Opened while floating near an edge, it is
/// first carried where its panel fits; a gesture still running applies the region at its end.
pub fn set_open<R: Runtime>(app: &AppHandle<R>, open: bool, calm: bool) {
    OPEN.store(open, Ordering::SeqCst);
    let Some(window) = windows::get(app, WIDGET) else {
        return;
    };
    let Ok(h) = window.hwnd() else { return };
    let raw = h.0 as isize;
    // Opened, it takes the keyboard (its search); closed, it never takes the focus again.
    let _ = window.set_focusable(open);
    if open {
        let _ = window.set_focus();
        crate::platform::own_window::force_foreground(raw);
    }
    if drive::running() {
        return;
    }
    let screens = windows::screens(app);
    let Some((a, scale, i)) = locate(&window, &screens) else {
        return;
    };
    if open && !is_docked() {
        let fit = fit_open(a, &screens[i].work, scale);
        if fit.minus(a).len() > 0.5 {
            let carry = physics::Gesture::settle(a, fit, i, scale, calm);
            drive::start(app.clone(), raw, screens, carry, scale);
            return;
        }
    }
    win::set_region(raw, Some(region_now(scale)));
}

/// The island's largest size at rest changed (music, a launch, the running apps' dots): the
/// click region follows it, unless a gesture or the opened panel holds the window.
pub fn set_footprint<R: Runtime>(app: &AppHandle<R>, width: f64, height: f64) {
    regions::set_footprint(width, height);
    if drive::running() || OPEN.load(Ordering::SeqCst) {
        return;
    }
    if let Some(window) = windows::get(app, WIDGET) {
        if let Ok(h) = window.hwnd() {
            let scale = window.scale_factor().unwrap_or(1.0);
            win::set_region(h.0 as isize, Some(region_now(scale)));
        }
    }
}

/// The page's effects are over: the window can be cut to the island again.
pub fn page_at_rest() {
    drive::page_at_rest();
}

/// A gesture ended at rest: remembered.
fn settled<R: Runtime>(app: &AppHandle<R>, docked: bool, slot: Slot) {
    set_place(docked, slot);
    let result = app.state::<ConfigState>().update_ui_state(|ui| {
        let changed = ui.widget_docked != docked || ui.widget_slot != slot;
        ui.widget_docked = docked;
        ui.widget_slot = slot;
        changed
    });
    if let Err(e) = result {
        tracing::warn!(error = %e, "could not remember where the island is");
    }
    if let Some(window) = windows::get(app, WIDGET) {
        super::placement::save_island_placement(app, &window);
    }
}

#[cfg(test)]
#[path = "island_tests.rs"]
mod tests;
