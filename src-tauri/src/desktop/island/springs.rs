//! Step 20 (Kysland): the springs of the island's gestures, and the rubber band of its pulls.

use super::physics::V2;

/// A damped spring (stiffness `k`, damping ratio `zeta`), stepped in small slices.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Spring {
    pub k: f64,
    pub zeta: f64,
}

/// Follows the hand: firm, with a little weight.
pub const FOLLOW: Spring = Spring {
    k: 1400.0,
    zeta: 0.86,
};
/// Slides along the top edge with the hand.
pub const SLIDE: Spring = Spring {
    k: 900.0,
    zeta: 0.9,
};
/// Carried to the top edge: one visible overshoot into the bezel.
pub const DOCK: Spring = Spring {
    k: 520.0,
    zeta: 0.7,
};
/// Let go along the top edge: snaps to its place (centre or corner).
pub const SNAP: Spring = Spring {
    k: 600.0,
    zeta: 0.78,
};
/// Put down where it is.
pub const DROP: Spring = Spring {
    k: 700.0,
    zeta: 0.92,
};
/// « Reduce motion »: no overshoot anywhere.
pub const CALM: Spring = Spring {
    k: 900.0,
    zeta: 1.0,
};

impl Spring {
    /// One step of `dt` seconds (semi-implicit Euler, cut in ≤ 2 ms slices: stable at any rate).
    pub fn step(self, p: &mut V2, v: &mut V2, target: V2, dt: f64) {
        let c = 2.0 * self.zeta * self.k.sqrt();
        let mut left = dt.clamp(0.0, 0.05);
        while left > 1e-9 {
            let h = left.min(0.002);
            let a = target.minus(*p).scale(self.k).minus(v.scale(c));
            *v = v.plus(a.scale(h));
            *p = p.plus(v.scale(h));
            left -= h;
        }
    }
}

/// Rubber band: `d` past a limit shows as at most `limit` (soft, never a wall).
pub fn rubber(d: f64, limit: f64) -> f64 {
    if limit <= 0.0 {
        return 0.0;
    }
    d.signum() * limit * (1.0 - 1.0 / (1.0 + d.abs() / limit))
}
