//! Kysland's music mode (2026-11-03): where the song is. A drop: the last 300 ms much louder than
//! the last 4 s, right after a calmer passage (a crash of velocity 1). A build: the highs rising
//! with no kick for 2 s. The gap before a drop: the sound falls by more than 70 % for 150 ms after
//! a build. A break: no kick for 2 s. Pure: fed one analysis at a time.

use super::music::Section;

/// A drop: the last 300 ms this much louder than the last 4 s…
const DROP_RATIO: f32 = 1.8;
/// …and than the loudest 300 ms of the 4 s before (unless a gap just came).
const DROP_OVER_PEAK: f32 = 1.3;
/// The drop detector waits for this ratio to fall back before it can fire again.
const REARM_RATIO: f32 = 1.2;
const SHORT_S: f32 = 0.3;
const LONG_S: f32 = 4.0;
/// Below this mean square the music is silent (about −70 dBFS).
const SILENCE: f32 = 1e-7;
/// The gap: the last 50 ms under 30 % of the sound before, for 150 ms, at most 4 s.
const GAP_FALL: f32 = 0.3;
const GAP_BACK: f32 = 0.5;
const GAP_MIN_S: f32 = 0.15;
const GAP_MAX_S: f32 = 4.0;
/// The build: no kick for 2 s and the highs up by 2 dB over 2 s; full after 4 s of it.
const BUILD_NO_KICK_S: f32 = 2.0;
const BUILD_RISE_DB: f32 = 2.0;
const BUILD_RAMP_S: f32 = 4.0;
/// Below this mean power the highs are silent.
const HI_SILENCE: f32 = 1e-10;

/// A running mean over the last `len` values.
struct Mean {
    values: Vec<f32>,
    next: usize,
    filled: usize,
    sum: f64,
}

impl Mean {
    fn new(len: usize) -> Self {
        Self {
            values: vec![0.0; len.max(1)],
            next: 0,
            filled: 0,
            sum: 0.0,
        }
    }

    fn push(&mut self, v: f32) -> f32 {
        self.sum += f64::from(v) - f64::from(self.values[self.next]);
        self.values[self.next] = v;
        self.next = (self.next + 1) % self.values.len();
        self.filled = (self.filled + 1).min(self.values.len());
        (self.sum.max(0.0) / self.filled as f64) as f32
    }
}

pub struct Form {
    hop_s: f32,
    analysed_s: f32,
    short: Mean,
    long: Mean,
    fast: Mean,
    /// The loudest 300 ms of each 50 ms block of the last 4 s.
    blocks: Vec<f32>,
    block_next: usize,
    block_max: f32,
    block_s: f32,
    armed: bool,
    since_drop: f32,
    since_kick: f32,
    since_gap: f32,
    low_s: f32,
    gap_ref: f32,
    gap: bool,
    /// The highs' level (dB), every 100 ms over the last 2 s.
    hi_db: f32,
    hi_ring: Vec<f32>,
    hi_next: usize,
    hi_filled: usize,
    hi_s: f32,
    build: f32,
    loudest: f32,
    loudest_decay: f32,
    section: Section,
}

fn smooth(hop_s: f32, tau_s: f32) -> f32 {
    1.0 - (-hop_s / tau_s).exp()
}

impl Form {
    pub fn new(hop_s: f32) -> Self {
        let hops = |s: f32| ((s / hop_s).round() as usize).max(1);
        Self {
            hop_s,
            analysed_s: 0.0,
            short: Mean::new(hops(SHORT_S)),
            long: Mean::new(hops(LONG_S)),
            fast: Mean::new(hops(0.05)),
            blocks: vec![0.0; 80],
            block_next: 0,
            block_max: 0.0,
            block_s: 0.0,
            armed: true,
            since_drop: f32::INFINITY,
            since_kick: f32::INFINITY,
            since_gap: f32::INFINITY,
            low_s: 0.0,
            gap_ref: 0.0,
            gap: false,
            hi_db: -120.0,
            hi_ring: vec![-120.0; 21],
            hi_next: 0,
            hi_filled: 0,
            hi_s: 0.0,
            build: 0.0,
            loudest: 0.0,
            loudest_decay: (-hop_s / 30.0).exp(),
            section: Section::Unknown,
        }
    }

    /// The loudest 300 ms in the 4 s before the last half second.
    fn peak_before(&self) -> f32 {
        let n = self.blocks.len();
        (10..n)
            .map(|back| self.blocks[(self.block_next + n - back) % n])
            .fold(0.0, f32::max)
    }

    /// One analysis: its mean square, the mean power of its highs (4–16 kHz), and whether a
    /// kick was heard. True on a drop.
    pub fn push(&mut self, energy: f32, hi: f32, kick: bool) -> bool {
        let h = self.hop_s;
        self.analysed_s += h;
        let (short, long, fast) = (
            self.short.push(energy),
            self.long.push(energy),
            self.fast.push(energy),
        );
        self.since_kick = if kick { 0.0 } else { self.since_kick + h };
        self.since_drop += h;
        self.since_gap += h;
        self.loudest = (self.loudest * self.loudest_decay).max(long);

        // The drop, then the blocks it compares with.
        let warm = self.analysed_s >= LONG_S;
        let calm_before = short > DROP_OVER_PEAK * self.peak_before() || self.since_gap < 1.0;
        let drop = warm && self.armed && long > SILENCE && short > DROP_RATIO * long && calm_before;
        if drop {
            self.armed = false;
            self.since_drop = 0.0;
            self.build = 0.0;
            self.gap = false;
            self.low_s = 0.0;
        } else if short < REARM_RATIO * long {
            self.armed = true;
        }
        self.block_max = self.block_max.max(short);
        self.block_s += h;
        if self.block_s >= 0.05 {
            self.blocks[self.block_next] = self.block_max;
            self.block_next = (self.block_next + 1) % self.blocks.len();
            self.block_max = 0.0;
            self.block_s -= 0.05;
        }

        // The gap: after a build, the sound falls and stays down.
        if !drop {
            if self.low_s == 0.0 {
                self.gap_ref = long;
            }
            if fast < GAP_FALL * self.gap_ref && self.gap_ref > SILENCE {
                self.low_s += h;
            } else if fast > GAP_BACK * self.gap_ref || self.gap_ref <= SILENCE {
                self.low_s = 0.0;
            }
            let was = self.gap;
            self.gap = (self.gap || self.build >= 0.3)
                && self.low_s >= GAP_MIN_S
                && self.low_s <= GAP_MAX_S;
            if was || self.gap {
                self.since_gap = 0.0;
            }
        }

        // The build: the highs rise over 2 s while no kick comes.
        self.hi_db += (10.0 * (hi.max(0.0) + 1e-12).log10() - self.hi_db) * smooth(h, 0.25);
        self.hi_s += h;
        if self.hi_s >= 0.1 {
            self.hi_s -= 0.1;
            self.hi_ring[self.hi_next] = self.hi_db;
            self.hi_next = (self.hi_next + 1) % self.hi_ring.len();
            self.hi_filled = (self.hi_filled + 1).min(self.hi_ring.len());
        }
        let oldest = if self.hi_filled == self.hi_ring.len() {
            self.hi_ring[self.hi_next]
        } else {
            self.hi_db
        };
        let rising = self.hi_db - oldest >= BUILD_RISE_DB && hi > HI_SILENCE;
        if drop || self.since_kick < 0.5 {
            // Kicks again (or the drop, already 0): the tension goes at once.
            self.build *= 1.0 - smooth(h, 0.12);
        } else if self.since_kick >= BUILD_NO_KICK_S && rising {
            self.build = (self.build + h / BUILD_RAMP_S).min(1.0);
        } else if !self.gap {
            self.build *= 1.0 - smooth(h, 2.5);
        }

        self.section = if self.gap || self.build >= 0.35 {
            Section::Build
        } else if self.since_drop < 2.0 {
            Section::Drop
        } else if !warm || short < SILENCE {
            Section::Unknown
        } else if self.since_kick >= BUILD_NO_KICK_S {
            Section::Break
        } else if long >= 0.5 * self.loudest {
            Section::Drop
        } else {
            Section::Unknown
        };
        drop
    }

    /// The build's tension, 0–1.
    pub fn build(&self) -> f32 {
        self.build
    }

    /// The silence just before a drop.
    pub fn gap(&self) -> bool {
        self.gap
    }

    pub fn section(&self) -> Section {
        self.section
    }
}
