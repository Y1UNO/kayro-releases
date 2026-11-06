//! The mouse in the air, with nothing of Windows (tested in pointer_tests.rs): what the hand
//! does, frame after frame, becomes cursor positions and button presses.
//!
//! - Thumb and index apart (the index stretched): the cursor is where the palm is. A zone in the
//!   middle of the camera's view, of the screen's proportions, covers the screen (the user's
//!   wish of 2026-11-05: hand and cursor always together, no « décalage »). The palm's centre
//!   (five points) is smoothed by a One Euro filter: strongly while it moves slowly (small moves
//!   are seen, without trembling), little while it moves quickly (no lag).
//! - A fist: the cursor stays where it was.
//! - Thumb and index pinched: the left button goes down, up when they part (held: a drag; twice
//!   quickly: Windows' double click). The index may bend to meet the thumb (the user's natural
//!   pinch, 2026-11-05), only not fold into the palm (a fist). The cursor stands still for a
//!   moment as the fingers close and part, so a click lands where it was aimed. A button goes up
//!   only when the fingers are seen apart twice in a row (or clearly apart once): a held pinch
//!   whose distance wavers does not flicker.
//! - Thumb and ring finger (or middle finger, the user's choice) pinched, the index still apart:
//!   the right button (the cursor still).
//! - The hand pushed past an edge of its zone a moment: the cursor goes to the screen beyond, if
//!   there is one (several screens; the zone covers one at a time).
//! - A thumb up held a second: « c'est bon », the hands turn off.
//! - No hand: a held button is let go.
//!
//! Distances are the model's metric points (cm), the same near or far from the camera. Measured
//! on 2026-11-05 (spikes/07-mains): thumb–index pinched 0.8–2.5 cm, apart 3–9; thumb–ring pinched
//! 1.8–2.4, otherwise 3.2 and more.

/// A pinch closes under this (cm)…
pub const PINCH_IN: f32 = 2.4;
/// …and opens again over this (two thresholds: no flicker in between).
pub const PINCH_OUT: f32 = 3.0;
/// The right pinch opens over this (cm): held, it wavers between 2.0 and 3.5 (the user's
/// test of 2026-11-05, the right button flickered at 3.0).
pub const RIGHT_OUT: f32 = 3.8;
/// One frame this far over the opening threshold (cm) is enough to let go.
pub const CLEARLY_APART: f32 = 1.0;
/// The right pinch counts only with the index this far from the thumb (no mix-up).
pub const RIGHT_NEEDS_INDEX: f32 = 4.0;
/// A pinch counts only with the index tip this far from its base (in wrist – index base
/// lengths): bent to meet the thumb, yes; folded into the palm (a fist), no.
pub const INDEX_OUT: f32 = 0.5;
/// The hand this far past an edge of its zone (zone widths)…
const EDGE_PUSH: f32 = 0.06;
/// …this long (s) takes the cursor to the screen beyond.
const PUSH_S: f64 = 0.3;
/// The cursor stands still this long as a pinch closes or opens (s).
pub const FREEZE_S: f64 = 0.15;
/// A thumb up held this long turns the hands off (s).
pub const THUMB_UP_S: f64 = 1.0;
/// A palm that jumps further than this in one frame (image widths) is a glitch of the model, not
/// a move: the frame is skipped.
pub const MAX_JUMP: f32 = 0.12;
/// The middle of the zone that covers the screen (image widths, both axes: the palm's usual
/// place, a little under the middle of a 4:3 view).
const ZONE_CENTER: [f32; 2] = [0.5, 0.40];
/// The zone's width at the user's « Amplitude » 1 (image widths); its height follows the screen.
const ZONE: f32 = 0.42;
/// One Euro filter on the palm (image widths): steadiness at rest (Hz), how fast it opens.
const MIN_CUTOFF: f32 = 0.6;
const BETA: f32 = 6.0;
const D_CUTOFF: f32 = 1.0;
/// Smaller changes are not sent (0–1 of the screen: a fifth of a pixel on a 1920 screen).
const STILL: f32 = 0.000_1;

/// What the camera saw of the hand in one frame.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Seen {
    /// The palm's centre, in image widths (both axes), already mirrored (the user's right is
    /// the right).
    pub anchor: [f32; 2],
    /// Thumb tip – index tip (cm).
    pub index_cm: f32,
    /// Thumb tip – the right click's finger tip (ring or middle, cm).
    pub right_cm: f32,
    /// The index is stretched (not a fist).
    pub pointing: bool,
    /// Index tip – index base, in wrist – index base lengths (bent in a pinch, small in a fist).
    pub index_reach: f32,
    /// A thumb up, the other fingers folded.
    pub thumb_up: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Button {
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Act {
    /// The cursor to this point, 0–1 of the screen.
    MoveTo([f32; 2]),
    Down(Button),
    Up(Button),
    /// The hand pushed past an edge: the screen beyond that way (−1, 0 or 1 on each axis).
    Cross([i8; 2]),
    /// The thumb up was held: the hands turn off.
    Off,
}

/// Which pinch holds a button.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Grip {
    Free,
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, Default)]
struct OneEuro {
    x: Option<f32>,
    dx: f32,
    t: f64,
}

fn alpha(cutoff: f32, dt: f32) -> f32 {
    let tau = 1.0 / (std::f32::consts::TAU * cutoff);
    1.0 / (1.0 + tau / dt)
}

impl OneEuro {
    fn step(&mut self, v: f32, t: f64) -> f32 {
        let Some(x) = self.x else {
            *self = Self {
                x: Some(v),
                dx: 0.0,
                t,
            };
            return v;
        };
        let dt = ((t - self.t) as f32).max(1e-3);
        self.t = t;
        let raw = (v - x) / dt;
        self.dx += alpha(D_CUTOFF, dt) * (raw - self.dx);
        let cutoff = MIN_CUTOFF + BETA * self.dx.abs();
        let next = x + alpha(cutoff, dt) * (v - x);
        self.x = Some(next);
        next
    }
}

/// The palm (image widths) on the screen (0–1, clamped): the zone at `reach`, as tall as the
/// screen's `aspect` (height / width) makes it.
pub fn to_screen(palm: [f32; 2], reach: f32, aspect: f32) -> [f32; 2] {
    let [x, y] = in_zone(palm, reach, aspect);
    [x.clamp(0.0, 1.0), y.clamp(0.0, 1.0)]
}

/// The palm in its zone, not clamped (under 0 or over 1: past an edge).
fn in_zone(palm: [f32; 2], reach: f32, aspect: f32) -> [f32; 2] {
    let w = ZONE * reach.clamp(0.5, 2.0);
    let h = w * aspect.clamp(0.3, 2.0);
    [
        (palm[0] - (ZONE_CENTER[0] - w / 2.0)) / w,
        (palm[1] - (ZONE_CENTER[1] - h / 2.0)) / h,
    ]
}

/// Which edge the hand is past (by `EDGE_PUSH`), if any.
fn past_edge([x, y]: [f32; 2]) -> Option<[i8; 2]> {
    if x < -EDGE_PUSH {
        Some([-1, 0])
    } else if x > 1.0 + EDGE_PUSH {
        Some([1, 0])
    } else if y < -EDGE_PUSH {
        Some([0, -1])
    } else if y > 1.0 + EDGE_PUSH {
        Some([0, 1])
    } else {
        None
    }
}

pub struct Pointer {
    reach: f32,
    aspect: f32,
    filter: [OneEuro; 2],
    grip: Grip,
    still_until: f64,
    thumb_since: Option<f64>,
    /// The palm as last seen, unfiltered (to catch a glitch).
    raw: Option<[f32; 2]>,
    sent: Option<[f32; 2]>,
    /// The held pinch was seen open in the last frame (once more lets it go).
    opening: bool,
    /// Since when the hand pushes past an edge, which one.
    push: Option<(f64, [i8; 2])>,
    /// Back inside the zone since the last crossing (one push, one screen).
    armed: bool,
    /// Frames with the thumb on the index but the index folded (a fist, or a pinch not seen as
    /// one: to tune `INDEX_OUT`), and the largest reach among them.
    pub refused: u32,
    pub refused_reach: f32,
}

impl Pointer {
    /// `reach`: the user's « Amplitude » (0.5–2); `aspect`: the screen's height / width.
    pub fn new(reach: f32, aspect: f32) -> Self {
        Self {
            reach,
            aspect,
            filter: [OneEuro::default(); 2],
            grip: Grip::Free,
            still_until: f64::MIN,
            thumb_since: None,
            raw: None,
            sent: None,
            opening: false,
            push: None,
            armed: true,
            refused: 0,
            refused_reach: 0.0,
        }
    }

    /// Another screen (its proportions).
    pub fn set_aspect(&mut self, aspect: f32) {
        self.aspect = aspect;
    }

    pub fn grip(&self) -> Grip {
        self.grip
    }

    /// One frame at `t` (s): what the hand did (`None`: no hand), and what to do about it.
    pub fn step(&mut self, seen: Option<&Seen>, t: f64, out: &mut Vec<Act>) {
        let Some(s) = seen else {
            self.release(out);
            self.filter = [OneEuro::default(); 2];
            self.thumb_since = None;
            self.raw = None;
            self.sent = None;
            self.push = None;
            return;
        };
        let jumped = self
            .raw
            .replace(s.anchor)
            .is_some_and(|r| (s.anchor[0] - r[0]).hypot(s.anchor[1] - r[1]) > MAX_JUMP);
        if jumped {
            // Nothing from this frame: its points may be wrong (the pinches too).
            return;
        }
        let palm = [
            self.filter[0].step(s.anchor[0], t),
            self.filter[1].step(s.anchor[1], t),
        ];

        if s.thumb_up && self.grip == Grip::Free {
            let since = *self.thumb_since.get_or_insert(t);
            if t - since >= THUMB_UP_S {
                self.thumb_since = None;
                out.push(Act::Off);
            }
            return;
        }
        self.thumb_since = None;

        let index_out = s.index_reach > INDEX_OUT;
        let grip = self.grip;
        match grip {
            Grip::Free if s.index_cm < PINCH_IN && !index_out => {
                self.refused += 1;
                self.refused_reach = self.refused_reach.max(s.index_reach);
            }
            Grip::Free if s.index_cm < PINCH_IN => {
                self.grip = Grip::Left;
                self.opening = false;
                self.still_until = t + FREEZE_S;
                out.push(Act::Down(Button::Left));
            }
            Grip::Free if index_out && s.right_cm < PINCH_IN && s.index_cm > RIGHT_NEEDS_INDEX => {
                self.grip = Grip::Right;
                self.opening = false;
                out.push(Act::Down(Button::Right));
            }
            Grip::Left if self.parted(s.index_cm, PINCH_OUT) => {
                self.grip = Grip::Free;
                self.still_until = t + FREEZE_S;
                out.push(Act::Up(Button::Left));
            }
            Grip::Right if self.parted(s.right_cm, RIGHT_OUT) => {
                self.grip = Grip::Free;
                self.still_until = t + FREEZE_S;
                out.push(Act::Up(Button::Right));
            }
            _ => {}
        }
        // A fist, the right button held or a pinch closing: the cursor stays. A drag moves even
        // with the index bent on the thumb.
        let moving = (s.pointing || self.grip == Grip::Left)
            && self.grip != Grip::Right
            && t >= self.still_until;
        if !moving {
            self.push = None;
            return;
        }
        let zone = in_zone(palm, self.reach, self.aspect);
        match past_edge(zone) {
            Some(edge) if self.armed => {
                let since = match self.push {
                    Some((since, e)) if e == edge => since,
                    _ => t,
                };
                self.push = Some((since, edge));
                if t - since >= PUSH_S {
                    self.push = None;
                    self.armed = false;
                    self.sent = None;
                    out.push(Act::Cross(edge));
                }
            }
            Some(_) => {}
            None => {
                self.push = None;
                if (0.0..=1.0).contains(&zone[0]) && (0.0..=1.0).contains(&zone[1]) {
                    self.armed = true;
                }
            }
        }
        let at = [zone[0].clamp(0.0, 1.0), zone[1].clamp(0.0, 1.0)];
        let far = self
            .sent
            .is_none_or(|p| (p[0] - at[0]).abs() > STILL || (p[1] - at[1]).abs() > STILL);
        if far {
            self.sent = Some(at);
            out.push(Act::MoveTo(at));
        }
    }

    /// The held pinch's fingers at `d` (cm), opening over `out_at`: let go? Twice in a row, or
    /// clearly apart once.
    fn parted(&mut self, d: f32, out_at: f32) -> bool {
        let apart = d > out_at;
        let go = apart && (self.opening || d > out_at + CLEARLY_APART);
        self.opening = apart && !go;
        go
    }

    /// Lets a held button go (the hand left, or the camera closes).
    pub fn release(&mut self, out: &mut Vec<Act>) {
        match std::mem::replace(&mut self.grip, Grip::Free) {
            Grip::Left => out.push(Act::Up(Button::Left)),
            Grip::Right => out.push(Act::Up(Button::Right)),
            Grip::Free => {}
        }
    }
}

#[cfg(test)]
#[path = "pointer_tests.rs"]
mod tests;
