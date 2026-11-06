//! The thread of one gesture: on each frame of the composition, read the cursor and the button,
//! step the physics, move the window, tell the page. It ends with the gesture (island at rest),
//! when a newer press starts another one, or when the window is gone; then it waits (2.5 s at
//! most) for the page's last bubbles before cutting the window to the island again. No loop runs
//! between gestures.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Runtime};
use tauri_specta::Event;

use super::physics::{Gesture, Moment, Phase, V2};
use super::slots::corner_of;
use super::{window_at, window_size, IslandFrame, IslandMoment, IslandMomentKind};
use crate::desktop::geometry::Screen;
use crate::platform::island as win;

/// The gesture running; a press starts a new one and the older thread stops.
static CURRENT: AtomicU64 = AtomicU64::new(0);
/// The last gesture that ended (its window cut again): none runs while it equals `CURRENT`.
static FINISHED: AtomicU64 = AtomicU64::new(0);
/// The island is at rest and the page still draws its effects; then the page says it is done.
static WAITING_REST: AtomicBool = AtomicBool::new(false);
static REST_READY: AtomicBool = AtomicBool::new(false);
/// The page needs no more than this many frames a second to draw its stretches.
const FRAME_EVERY: Duration = Duration::from_millis(6);
/// A gesture never runs longer than this without the button held (a stuck spring).
const SETTLE_CEILING: Duration = Duration::from_secs(4);
/// How long the window stays uncut for the page's effects, at most.
const REST_CEILING: Duration = Duration::from_millis(2500);
/// The lightness behind a floating island is measured again after this much travel and time.
const BACKDROP_TRAVEL: f64 = 80.0;
const BACKDROP_EVERY: Duration = Duration::from_millis(400);

/// A gesture owns the window (moving, or waiting for the page's last effects).
pub fn running() -> bool {
    CURRENT.load(Ordering::SeqCst) != FINISHED.load(Ordering::SeqCst)
}

/// The page's loop has stopped: its bubbles are gone.
pub fn page_at_rest() {
    if WAITING_REST.load(Ordering::SeqCst) {
        REST_READY.store(true, Ordering::SeqCst);
    }
}

fn moment(m: Moment) -> IslandMoment {
    let (kind, dir, docked, slot) = match m {
        Moment::Detached => (IslandMomentKind::Detached, V2::default(), false, None),
        Moment::Crossed { dir } => (IslandMomentKind::Crossed, dir, false, None),
        Moment::Docking => (IslandMomentKind::Docking, V2::default(), true, None),
        Moment::Touched => (IslandMomentKind::Touched, V2::default(), true, None),
        Moment::Snapped { slot } => (IslandMomentKind::Snapped, V2::default(), true, Some(slot)),
        Moment::Dropped => (IslandMomentKind::Dropped, V2::default(), false, None),
        Moment::Tap => (
            IslandMomentKind::Tap,
            V2::default(),
            super::is_docked(),
            None,
        ),
        Moment::Settled { docked, slot } => (
            IslandMomentKind::Settled,
            V2::default(),
            docked,
            docked.then_some(slot),
        ),
    };
    IslandMoment {
        kind,
        dir_x: dir.x,
        dir_y: dir.y,
        docked,
        corner: slot.map_or(0.0, corner_of),
    }
}

/// The island's screen as insets of the window at (`x`, `y`), in logical pixels.
fn clip(screen: &Screen, x: i32, y: i32, scale: f64) -> [f64; 4] {
    let (w, h) = window_size(scale);
    let r = &screen.rect;
    let inset = |v: i64| (v as f64 / scale).max(0.0);
    [
        inset(i64::from(r.y) - i64::from(y)),
        inset(i64::from(x) + i64::from(w) - (i64::from(r.x) + i64::from(r.width))),
        inset(i64::from(y) + i64::from(h) - (i64::from(r.y) + i64::from(r.height))),
        inset(i64::from(r.x) - i64::from(x)),
    ]
}

pub fn start<R: Runtime>(
    app: AppHandle<R>,
    raw: isize,
    screens: Vec<Screen>,
    mut g: Gesture,
    scale: f64,
) {
    let mine = CURRENT.fetch_add(1, Ordering::SeqCst) + 1;
    WAITING_REST.store(false, Ordering::SeqCst);
    // The whole stage shows and takes the clicks while the island moves and stretches.
    win::set_region(raw, Some(super::moving_region(scale)));
    let spawned = std::thread::Builder::new()
        .name("island-gesture".into())
        .spawn(move || {
            let mut last = Instant::now();
            let mut sent = last - FRAME_EVERY;
            let mut let_go: Option<Instant> = None;
            let mut place = (super::is_docked(), super::slot_now());
            // Measure the backdrop on the first frames, then as the island travels.
            let mut measured: Option<(Instant, V2)> = None;
            let mut measure_now = true;
            let mut moved_to: Option<(i32, i32)> = None;
            while CURRENT.load(Ordering::SeqCst) == mine && win::alive(raw) {
                if !win::next_frame() {
                    std::thread::sleep(Duration::from_millis(4));
                }
                let now = Instant::now();
                let dt = (now - last).as_secs_f64();
                last = now;
                let Some((cx, cy)) = win::cursor() else { break };
                let held = win::primary_held() && let_go.is_none();
                if !held && let_go.is_none() {
                    let_go = Some(now);
                }
                let step = g.step(&screens, V2::new(f64::from(cx), f64::from(cy)), held, dt);
                let (x, y) = window_at(step.anchor, scale);
                if moved_to != Some((x, y)) {
                    moved_to = Some((x, y));
                    win::move_to(raw, x, y);
                }
                let screen = &screens[g.screen.min(screens.len().saturating_sub(1))];
                let travelled = measured.is_some_and(|(t, at)| {
                    now - t > BACKDROP_EVERY
                        && step.anchor.minus(at).len() > BACKDROP_TRAVEL * scale
                });
                let backdrop = if measure_now || travelled || step.done {
                    measure_now = false;
                    measured = Some((now, step.anchor));
                    super::backdrop_at(step.anchor, scale, screen)
                } else {
                    None
                };
                if step.done {
                    WAITING_REST.store(true, Ordering::SeqCst);
                    REST_READY.store(false, Ordering::SeqCst);
                }
                let urgent = step.done || !step.moments.is_empty() || backdrop.is_some();
                if now - sent >= FRAME_EVERY || urgent {
                    sent = now;
                    let frame = IslandFrame {
                        holding: g.phase == Phase::Holding,
                        vx: step.look.velocity.x,
                        vy: step.look.velocity.y,
                        pull_x: step.look.pull.x,
                        pull_y: step.look.pull.y,
                        tension: step.look.tension,
                        near: step.look.near,
                        corner: step.look.corner,
                        x,
                        y,
                        scale,
                        clip: if g.free_between_screens() {
                            [0.0; 4]
                        } else {
                            clip(screen, x, y, scale)
                        },
                        seam_x: step.look.seam.0.map(|v| (v - f64::from(x)) / scale),
                        seam_y: step.look.seam.1.map(|v| (v - f64::from(y)) / scale),
                        backdrop,
                    };
                    crate::ipc::notify(frame.emit(&app));
                }
                for m in &step.moments {
                    match *m {
                        Moment::Detached | Moment::Dropped => super::set_place(false, g.slot),
                        Moment::Touched => super::set_place(true, g.slot),
                        Moment::Crossed { .. } => measure_now = true,
                        Moment::Settled { docked, slot } => place = (docked, slot),
                        _ => {}
                    }
                    crate::ipc::notify(moment(*m).emit(&app));
                }
                let stuck = let_go.is_some_and(|t| now - t > SETTLE_CEILING);
                if stuck {
                    place = (matches!(g.phase, Phase::Settling { dock: true }), g.slot);
                }
                if step.done || stuck {
                    break;
                }
            }
            // A newer press owns the window now; otherwise the island is at rest.
            if CURRENT.load(Ordering::SeqCst) != mine {
                return;
            }
            if !win::alive(raw) {
                FINISHED.store(mine, Ordering::SeqCst);
                return;
            }
            super::settled(&app, place.0, place.1);
            rest(raw, mine, scale);
        });
    if let Err(e) = spawned {
        tracing::warn!(error = %e, "island: no gesture thread");
        win::set_region(raw, Some(super::region_now(scale)));
        FINISHED.store(mine, Ordering::SeqCst);
    }
}

/// Waits for the page's effects to end (or a newer press), then cuts the window to the island.
fn rest(raw: isize, mine: u64, scale: f64) {
    WAITING_REST.store(true, Ordering::SeqCst);
    let since = Instant::now();
    while !REST_READY.load(Ordering::SeqCst) && since.elapsed() < REST_CEILING {
        if CURRENT.load(Ordering::SeqCst) != mine {
            return;
        }
        std::thread::sleep(Duration::from_millis(30));
    }
    WAITING_REST.store(false, Ordering::SeqCst);
    if CURRENT.load(Ordering::SeqCst) == mine {
        if win::alive(raw) {
            win::set_region(raw, Some(super::region_now(scale)));
        }
        FINISHED.store(mine, Ordering::SeqCst);
    }
}
