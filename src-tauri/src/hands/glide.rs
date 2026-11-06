//! The cursor between two camera frames (the user's demand of 2026-11-05: « plus fluide »): the
//! webcam gives 15–30 frames a second, the screen shows 144–280; a thread of its own glides the
//! cursor to where the hand puts it, every 4 ms, with an 18 ms easing, and moves the glow with it.
//! It parks (no loop) once the cursor is there. A move of the real mouse wins: the glide starts
//! again from where the mouse put the cursor.

use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Runtime};

use super::glow;
use super::pointer::Grip;
use crate::platform::mouse;

const TICK: Duration = Duration::from_millis(4);
/// The easing's time constant (s): most of the way in 2–3 ticks, no visible lag.
const TAU_S: f64 = 0.018;
/// Closer than this (px), the cursor is there.
const THERE: f64 = 0.3;
/// The real mouse moved the cursor this far from where the glide put it (px): it wins.
const MOUSE_WINS: i32 = 3;

struct State {
    target: Option<[f64; 2]>,
    current: [f64; 2],
    sent: Option<(i32, i32)>,
    grip: Grip,
    painted: Option<Grip>,
    stop: bool,
}

type Shared = Arc<(Mutex<State>, Condvar)>;

pub struct Glide {
    shared: Shared,
    thread: Option<JoinHandle<()>>,
}

fn lock(s: &Shared) -> MutexGuard<'_, State> {
    s.0.lock().unwrap_or_else(|p| p.into_inner())
}

impl Glide {
    /// Starts the thread; `glow`: the glow follows the cursor.
    pub fn start<R: Runtime>(app: &AppHandle<R>, glow: bool) -> Self {
        let shared: Shared = Arc::new((
            Mutex::new(State {
                target: None,
                current: [0.0; 2],
                sent: None,
                grip: Grip::Free,
                painted: None,
                stop: false,
            }),
            Condvar::new(),
        ));
        let app = app.clone();
        let for_thread = shared.clone();
        let thread = std::thread::Builder::new()
            .name("hands-glide".into())
            .spawn(move || run(&app, &for_thread, glow))
            .ok();
        Self { shared, thread }
    }

    /// The hand puts the cursor at `p` (physical pixels of the desktop): it glides there.
    pub fn aim(&self, p: [f64; 2]) {
        let mut s = lock(&self.shared);
        let cursor = mouse::cursor();
        let moved_by_mouse = match (s.sent, cursor) {
            (Some((sx, sy)), Some((cx, cy))) => {
                (sx - cx).abs() > MOUSE_WINS || (sy - cy).abs() > MOUSE_WINS
            }
            _ => false,
        };
        if s.target.is_none() || moved_by_mouse {
            // From where the cursor is (the real mouse moved it, or the hand just came).
            if let Some((x, y)) = cursor {
                s.current = [f64::from(x), f64::from(y)];
                s.sent = Some((x, y));
            }
        }
        s.target = Some(p);
        self.shared.1.notify_all();
    }

    /// The hand is seen: the glow shows (in the colour of `grip`), even before it moves.
    pub fn lead(&self, grip: Grip) {
        let mut s = lock(&self.shared);
        if s.target.is_none() {
            if let Some((x, y)) = mouse::cursor() {
                let p = [f64::from(x), f64::from(y)];
                s.current = p;
                s.target = Some(p);
                s.sent = Some((x, y));
            }
        }
        s.grip = grip;
        self.shared.1.notify_all();
    }

    /// Before a button goes down or up: the cursor where it is going, now.
    pub fn snap(&self) {
        let mut s = lock(&self.shared);
        if let Some(t) = s.target {
            s.current = t;
            let p = (t[0].round() as i32, t[1].round() as i32);
            if s.sent != Some(p) {
                mouse::move_to(p.0, p.1);
                s.sent = Some(p);
            }
        }
    }

    /// The hand left: nothing leads the cursor, the glow goes.
    pub fn leave(&self) {
        lock(&self.shared).target = None;
        self.shared.1.notify_all();
    }
}

impl Drop for Glide {
    fn drop(&mut self) {
        lock(&self.shared).stop = true;
        self.shared.1.notify_all();
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

enum Paint {
    None,
    Show(i32, i32, Grip),
    Place(i32, i32),
}

fn run<R: Runtime>(app: &AppHandle<R>, shared: &Shared, glow_on: bool) {
    let images = [Grip::Free, Grip::Left, Grip::Right].map(glow::image);
    let mut last = Instant::now();
    loop {
        let (moved, paint, settled) = {
            let mut s = lock(shared);
            if s.stop {
                drop(s);
                glow::hide();
                return;
            }
            let Some(target) = s.target else {
                if s.painted.take().is_some() {
                    drop(s);
                    glow::hide();
                } else {
                    // Parked until the hand comes back.
                    let _parked = shared.1.wait(s).unwrap_or_else(|p| p.into_inner());
                    last = Instant::now();
                }
                continue;
            };
            let dt = last.elapsed().as_secs_f64().min(0.05);
            last = Instant::now();
            let k = 1.0 - (-dt / TAU_S).exp();
            for (c, t) in s.current.iter_mut().zip(target) {
                *c += (t - *c) * k;
                if (t - *c).abs() < THERE {
                    *c = t;
                }
            }
            let p = (s.current[0].round() as i32, s.current[1].round() as i32);
            let moved = (s.sent != Some(p)).then_some(p);
            if moved.is_some() {
                s.sent = Some(p);
            }
            let paint = if !glow_on {
                Paint::None
            } else if s.painted != Some(s.grip) {
                s.painted = Some(s.grip);
                Paint::Show(p.0, p.1, s.grip)
            } else if moved.is_some() {
                Paint::Place(p.0, p.1)
            } else {
                Paint::None
            };
            (moved, paint, s.current == target)
        };
        if let Some((x, y)) = moved {
            mouse::move_to(x, y);
        }
        match paint {
            Paint::None => {}
            Paint::Show(x, y, grip) => glow::show(app, x, y, &images[grip as usize]),
            Paint::Place(x, y) => glow::place(x, y),
        }
        if settled {
            // Parked until the hand moves the target again (or leaves).
            let s = lock(shared);
            let current = s.current;
            let _parked = shared
                .1
                .wait_while(s, |s| {
                    let glow_ready = !glow_on || s.painted == Some(s.grip);
                    !s.stop
                        && match s.target {
                            Some(t) => t == current && glow_ready,
                            None => s.painted.is_none(),
                        }
                })
                .unwrap_or_else(|p| p.into_inner());
            last = Instant::now();
        } else {
            std::thread::sleep(TICK);
        }
    }
}
