//! Step 20 (Kysland): the island's gesture as pure physics, so every feel (the pull that tears it
//! off the top edge, the slide along it into a corner, the screen edge it must be forced through,
//! the magnet of the top edge, the springs) is covered by tests. Positions are the island's
//! **anchor** (centre of its top edge), in physical pixels; every distance below is in logical
//! pixels, scaled by the screen's factor.

use crate::desktop::geometry::Screen;

use crate::config::schema::IslandPassage;

pub use super::slots::{clamp_anchor, screen_of};
use super::slots::{clamp_on_desk, corner_at, dock_top, nearest_slot, seam_of, slot_anchor, Slot};
pub use super::springs::*;

/// Downward pull (from the press) that tears the island off the top edge.
pub const DETACH: f64 = 56.0;
/// How far past a screen's edge the island must be pushed before it goes through.
pub const BREAK: f64 = 110.0;
/// Released with its top this close to a screen's top edge, the island docks there.
pub const DOCK_ZONE: f64 = 90.0;
/// Below this, a press that ends is a tap.
pub const TAP_SLOP: f64 = 5.0;
/// Size of the floating island (its collisions with the screen's edges).
pub const FLOAT_SIZE: (f64, f64) = (176.0, 44.0);
/// The push against an edge, as the page shows it (squashed against the edge, never past it).
const PUSH_SHOWN: f64 = 26.0;
/// Share of the distance to the top edge the magnet takes back, at its strongest.
const MAGNET: f64 = 0.3;

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct V2 {
    pub x: f64,
    pub y: f64,
}

impl V2 {
    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
    pub fn len(self) -> f64 {
        self.x.hypot(self.y)
    }
    pub fn minus(self, o: V2) -> V2 {
        V2::new(self.x - o.x, self.y - o.y)
    }
    pub fn plus(self, o: V2) -> V2 {
        V2::new(self.x + o.x, self.y + o.y)
    }
    pub fn scale(self, k: f64) -> V2 {
        V2::new(self.x * k, self.y * k)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    /// On the top edge: a sideways pull slides it, a downward one stretches it until it tears.
    Holding,
    /// Torn off, following the hand.
    Free,
    /// Let go: carried to the top edge (`dock`) or put down.
    Settling { dock: bool },
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Moment {
    /// Torn off the top edge.
    Detached,
    /// Forced through to another screen; `dir` points the way it went.
    Crossed { dir: V2 },
    /// Let go in the top edge's zone: on its way there.
    Docking,
    /// Reached the top edge (the bezel takes it).
    Touched,
    /// A slide along the top edge ended in its place.
    Snapped { slot: Slot },
    /// Let go elsewhere.
    Dropped,
    /// A press without a pull.
    Tap,
    /// At rest; `docked` and `slot` say where.
    Settled { docked: bool, slot: Slot },
}

/// What the page needs to draw a frame (logical pixels).
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Look {
    pub velocity: V2,
    /// Docked: x = the push past a corner, y = the downward pull. Free: the push against an edge.
    pub pull: V2,
    /// Docked: how far towards tearing off (0–1).
    pub tension: f64,
    /// 0–1: how close to the top edge's magnet.
    pub near: f64,
    /// -1 (left corner) … 1 (right corner).
    pub corner: f64,
    /// « Glitch »: the edge between two screens that cuts through the island (x, y; physical).
    pub seam: (Option<f64>, Option<f64>),
}

pub struct Step {
    pub anchor: V2,
    pub look: Look,
    pub moments: Vec<Moment>,
    pub done: bool,
}

/// One gesture, from the press to the rest.
pub struct Gesture {
    pub phase: Phase,
    /// Index of the screen the island belongs to.
    pub screen: usize,
    /// Its place on the top edge (docked, or on its way there).
    pub slot: Slot,
    scale: f64,
    press: V2,
    /// Anchor minus cursor at the press.
    offset: V2,
    pub p: V2,
    v: V2,
    target: V2,
    moved: bool,
    /// Moved along the top edge (a slide, not a tap).
    slid: bool,
    /// Settling along the top edge (no landing on it).
    along: bool,
    touched: bool,
    calm: bool,
    passage: IslandPassage,
}

impl Gesture {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        anchor: V2,
        cursor: V2,
        docked: bool,
        slot: Slot,
        screen: usize,
        scale: f64,
        calm: bool,
        passage: IslandPassage,
    ) -> Self {
        Self {
            phase: if docked { Phase::Holding } else { Phase::Free },
            screen,
            slot,
            scale,
            press: cursor,
            offset: anchor.minus(cursor),
            p: anchor,
            v: V2::default(),
            target: anchor,
            moved: false,
            slid: false,
            along: false,
            touched: false,
            calm,
            passage,
        }
    }

    /// « Glitch »: the floating island may sit across two screens (no edge cuts it).
    pub fn free_between_screens(&self) -> bool {
        self.passage == IslandPassage::Glitch
            && matches!(self.phase, Phase::Free | Phase::Settling { dock: false })
    }

    /// No hand: the island is carried from `anchor` to `target` and put down there (it moves
    /// so that, opened, it fits on its screen).
    pub fn settle(anchor: V2, target: V2, screen: usize, scale: f64, calm: bool) -> Self {
        let force = IslandPassage::Force;
        let mut g = Self::new(
            anchor,
            anchor,
            false,
            Slot::Center,
            screen,
            scale,
            calm,
            force,
        );
        g.moved = true;
        g.target = target;
        g.phase = Phase::Settling { dock: false };
        g
    }

    fn spring(&self) -> Spring {
        if self.calm {
            return CALM;
        }
        match self.phase {
            Phase::Holding => SLIDE,
            Phase::Free => FOLLOW,
            Phase::Settling { dock: true } if self.along => SNAP,
            Phase::Settling { dock: true } => DOCK,
            Phase::Settling { dock: false } => DROP,
        }
    }

    /// Advances by `dt` seconds with the cursor at `cursor` and the button `held`.
    pub fn step(&mut self, screens: &[Screen], cursor: V2, held: bool, dt: f64) -> Step {
        let mut moments = Vec::new();
        let mut look = Look::default();
        let s = self.scale;
        if cursor.minus(self.press).len() > TAP_SLOP * s {
            self.moved = true;
        }
        if screens.is_empty() {
            return Step {
                anchor: self.p,
                look,
                moments,
                done: true,
            };
        }
        self.screen = self.screen.min(screens.len() - 1);
        match self.phase {
            Phase::Holding => {
                self.hold(&screens[self.screen], cursor, held, &mut look, &mut moments)
            }
            Phase::Free => self.carry(screens, cursor, held, &mut look, &mut moments),
            Phase::Settling { .. } => {}
        }
        if moments.contains(&Moment::Tap) {
            return Step {
                anchor: self.p,
                look,
                moments,
                done: true,
            };
        }
        self.spring()
            .step(&mut self.p, &mut self.v, self.target, dt);
        look.velocity = self.v.scale(1.0 / s);
        look.corner = corner_at(&screens[self.screen], self.p.x);
        // « Glitch »: the edge under the island where it is now, up to its rest (it may rest across).
        if self.free_between_screens() {
            look.seam = seam_of(screens, self.screen, self.p, s);
        }
        let mut done = false;
        if let Phase::Settling { dock } = self.phase {
            if dock && !self.along && !self.touched && self.p.y <= self.target.y + 0.5 {
                self.touched = true;
                moments.push(Moment::Touched);
            }
            if self.p.minus(self.target).len() < 0.5 && self.v.len() < 8.0 {
                self.p = self.target;
                if dock && self.along && self.slid {
                    moments.push(Moment::Snapped { slot: self.slot });
                }
                moments.push(Moment::Settled {
                    docked: dock,
                    slot: self.slot,
                });
                done = true;
            }
        }
        Step {
            anchor: self.p,
            look,
            moments,
            done,
        }
    }

    /// On the top edge: slides with the hand between the corners, stretches when pulled down.
    fn hold(
        &mut self,
        screen: &Screen,
        cursor: V2,
        held: bool,
        look: &mut Look,
        out: &mut Vec<Moment>,
    ) {
        let s = self.scale;
        let down = (cursor.y - self.press.y).max(0.0);
        let wanted = cursor.x + self.offset.x;
        let lo = slot_anchor(screen, Slot::Left).x;
        let hi = slot_anchor(screen, Slot::Right).x;
        let x = wanted.clamp(lo, hi.max(lo));
        if (cursor.x - self.press.x).abs() > TAP_SLOP * s {
            self.slid = true;
        }
        self.target = V2::new(x, dock_top(screen));
        look.pull = V2::new(rubber((wanted - x) / s, PUSH_SHOWN), rubber(down / s, 60.0));
        look.tension = (down / (DETACH * s)).min(1.0);
        if !held {
            if !self.moved {
                out.push(Moment::Tap);
                return;
            }
            self.slot = nearest_slot(screen, self.p.x);
            self.target = slot_anchor(screen, self.slot);
            self.along = true;
            self.phase = Phase::Settling { dock: true };
        } else if down > DETACH * s {
            self.phase = Phase::Free;
            out.push(Moment::Detached);
        }
    }

    /// Torn off: follows the hand, held back by the screen's edges until forced through one.
    fn carry(
        &mut self,
        screens: &[Screen],
        cursor: V2,
        held: bool,
        look: &mut Look,
        out: &mut Vec<Moment>,
    ) {
        let s = self.scale;
        let wanted = cursor.plus(self.offset);
        let mut aim = clamp_anchor(wanted, &screens[self.screen].work, s);
        let over = wanted.minus(aim);
        let elsewhere = screen_of(screens, wanted, s).filter(|&i| i != self.screen);
        if self.passage == IslandPassage::Glitch {
            aim = self.glide(screens, wanted, look, out);
        } else {
            match elsewhere {
                Some(i) if over.len() > BREAK * s => {
                    let dir = over.scale(1.0 / over.len().max(1e-6));
                    self.screen = i;
                    aim = clamp_anchor(wanted, &screens[i].work, s);
                    out.push(Moment::Crossed { dir });
                }
                // Held back: it stays inside its screen and shows the push (squashed against it).
                _ => {
                    look.pull = V2::new(
                        rubber(over.x / s, PUSH_SHOWN),
                        rubber(over.y / s, PUSH_SHOWN),
                    )
                }
            }
        }
        let home = &screens[self.screen];
        let gap = (aim.y - dock_top(home)).max(0.0);
        look.near = (1.0 - gap / (DOCK_ZONE * s)).clamp(0.0, 1.0);
        aim.y -= gap * MAGNET * look.near * look.near;
        self.target = aim;
        if !held {
            let dock = look.near > 0.0;
            if dock {
                self.slot = nearest_slot(home, aim.x);
                self.target = slot_anchor(home, self.slot);
            } else if self.passage == IslandPassage::Glitch {
                // « Glitch »: it may stay across two screens.
                self.target = clamp_on_desk(aim, screens, self.screen, s);
            } else {
                self.target = clamp_anchor(aim, &home.work, s);
            }
            self.phase = Phase::Settling { dock };
            out.push(if dock {
                Moment::Docking
            } else {
                Moment::Dropped
            });
        }
    }

    /// « Glitch » passage: nothing holds the island back between two screens (it may sit across
    /// both); only the desk's outer edges do. Crossing to another screen is a moment.
    fn glide(
        &mut self,
        screens: &[Screen],
        wanted: V2,
        look: &mut Look,
        out: &mut Vec<Moment>,
    ) -> V2 {
        let s = self.scale;
        let home = screen_of(screens, wanted, s).unwrap_or(self.screen);
        let aim = clamp_on_desk(wanted, screens, home, s);
        if home != self.screen {
            let centre = |i: usize| {
                let r = &screens[i].rect;
                let half = V2::new(f64::from(r.width), f64::from(r.height)).scale(0.5);
                V2::new(f64::from(r.x), f64::from(r.y)).plus(half)
            };
            let way = centre(home).minus(centre(self.screen));
            self.screen = home;
            out.push(Moment::Crossed {
                dir: way.scale(1.0 / way.len().max(1e-6)),
            });
        }
        let pushed = wanted.minus(aim);
        look.pull = V2::new(
            rubber(pushed.x / s, PUSH_SHOWN),
            rubber(pushed.y / s, PUSH_SHOWN),
        );
        look.seam = seam_of(screens, self.screen, aim, s);
        aim
    }
}

#[cfg(test)]
#[path = "physics_tests.rs"]
mod tests;
