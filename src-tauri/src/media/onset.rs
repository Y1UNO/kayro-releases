//! Kysland's music mode (2026-11-03): the hits of one band, from its spectral flux. A hit is a
//! local peak of the flux above an adaptive threshold (the median of the last second plus k times
//! its median absolute deviation, never below a floor nor a share of the band's recent hits),
//! while the band's level rises, out of the band's refractory time. The kick also needs its band
//! louder than its last second: a bass note or the beat of the kick's tail with the bass is not
//! a kick. The velocity (0–1) is the flux over an automatic gain (the recent hits, forgotten in
//! about twenty seconds), so that a quiet song and a loud one react alike. Pure; a peak is
//! confirmed one analysis later (about 5 ms).

/// The threshold's k, before the sensitivity (higher sensitivity: lower threshold).
const K: f32 = 2.5;
/// The threshold is never below this share of the band's automatic gain (its recent hits).
pub const SHARE: f32 = 0.2;
/// How long the threshold's memory is (s).
const MEMORY_S: f32 = 1.0;
/// The automatic gain forgets a loud passage with this time constant (s): a tenth after 23 s (a
/// soft passage's hits stay soft, 2026-11-03: the bass stood out over the melody at 8 s).
const GAIN_TAU_S: f32 = 10.0;
/// A hit raises the gain to its flux, but by this factor at most: the first kick after a silence
/// (its band was empty, its flux is huge) does not leave the next ones weak for seconds.
const GAIN_GROWTH: f32 = 1.25;
/// A hit also raises the band's level (+2 dB on the 3 analyses before): the flux of a noisy
/// decay (a snare's tail) wavers bin by bin while the band as a whole goes down.
const RISE: f32 = 1.25;

pub struct Onset {
    /// The last second of flux and of the band's level (rings), and room to sort.
    history: Vec<f32>,
    loudness: Vec<f32>,
    loudness_sum: f64,
    next: usize,
    filled: usize,
    scratch: Vec<f32>,
    /// The flux of the newest analysis and of the one before, and the thresholds they face.
    last: [f32; 2],
    thresholds: [f32; 2],
    /// The band's level in the last four analyses, newest first.
    levels: [f32; 4],
    /// Seconds since the last hit (as of the newest analysis).
    since: f32,
    gain: f32,
    gain_decay: f32,
    hop_s: f32,
    refractory_s: f32,
    floor: f32,
    /// How much louder than its last second the band must be (0: no such check).
    loud: f32,
    share: f32,
    /// 1 / the sensitivity (0.5–2): scales the whole threshold.
    strictness: f32,
}

/// A hit found by [`Onset::push`]: its velocity, and its flux (for the crash's checks).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Peak {
    pub velocity: f32,
    pub flux: f32,
}

/// The median of `values` (reordered).
pub fn median(values: &mut [f32]) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    let mid = values.len() / 2;
    *values.select_nth_unstable_by(mid, f32::total_cmp).1
}

impl Onset {
    /// `floor`: the least flux that can be a hit; `refractory_s`: the least time between hits.
    pub fn new(hop_s: f32, refractory_s: f32, floor: f32) -> Self {
        let len = ((MEMORY_S / hop_s).round() as usize).max(8);
        Self {
            history: vec![0.0; len],
            loudness: vec![0.0; len],
            loudness_sum: 0.0,
            next: 0,
            filled: 0,
            scratch: Vec::with_capacity(len),
            last: [0.0; 2],
            thresholds: [f32::INFINITY; 2],
            levels: [0.0; 4],
            since: f32::INFINITY,
            gain: floor * 2.0,
            gain_decay: (-hop_s / GAIN_TAU_S).exp(),
            hop_s,
            refractory_s,
            floor,
            loud: 0.0,
            share: SHARE,
            strictness: 1.0,
        }
    }

    /// The kick's checks: its band `loud` times its mean level of the last second, and a flux
    /// of at least `share` of its recent hits' (a bass note between the kicks is weaker).
    pub fn kick(mut self, loud: f32, share: f32) -> Self {
        self.loud = loud;
        self.share = share;
        self
    }

    /// The detection sensitivity, 0.5–2 (1: the defaults; higher: more hits).
    pub fn set_sensitivity(&mut self, sense: f32) {
        self.strictness = 1.0 / sense.clamp(0.5, 2.0);
    }

    /// The threshold for the next flux, from the last second.
    fn next_threshold(&mut self) -> f32 {
        self.scratch.clear();
        self.scratch.extend_from_slice(&self.history[..self.filled]);
        let mid = median(&mut self.scratch);
        for v in &mut self.scratch {
            *v = (*v - mid).abs();
        }
        let spread = median(&mut self.scratch);
        let adaptive = mid + K * self.strictness * spread;
        let least = (self.floor * self.strictness).max(self.share * self.strictness * self.gain);
        adaptive.max(least)
    }

    /// Takes the newest flux and the band's level (its mean magnitude); returns the hit of the
    /// analysis before, if it was one.
    pub fn push(&mut self, flux: f32, level: f32) -> Option<Peak> {
        let flux = if flux.is_finite() { flux.max(0.0) } else { 0.0 };
        let level = if level.is_finite() {
            level.max(0.0)
        } else {
            0.0
        };
        self.since += self.hop_s;
        self.levels.rotate_right(1);
        self.levels[0] = level;
        let [candidate, before] = self.last;
        let held_to = self.thresholds[0];
        let top = self.levels[0].max(self.levels[1]);
        let mean = (self.loudness_sum / self.filled.max(1) as f64) as f32;
        let loud = self.loud <= 0.0 || top >= (1.0 + (self.loud - 1.0) * self.strictness) * mean;
        let peak = candidate > held_to
            && candidate >= before
            && candidate > flux
            && top >= RISE * self.levels[3]
            && loud
            && self.since - self.hop_s >= self.refractory_s - 1e-4;
        // The newest flux faces the second before it (and the gain before it).
        let threshold = self.next_threshold();
        self.gain = (self.gain * self.gain_decay).max(self.floor * 2.0);
        self.history[self.next] = flux;
        self.loudness_sum += f64::from(level) - f64::from(self.loudness[self.next]);
        self.loudness_sum = self.loudness_sum.max(0.0);
        self.loudness[self.next] = level;
        self.next = (self.next + 1) % self.history.len();
        self.filled = (self.filled + 1).min(self.history.len());
        self.last = [flux, candidate];
        self.thresholds = [threshold, held_to];
        if !peak {
            return None;
        }
        self.since = self.hop_s;
        let velocity = (candidate / self.gain).clamp(0.0, 1.0);
        self.gain = self.gain.max(candidate.min(GAIN_GROWTH * self.gain));
        Some(Peak {
            velocity,
            flux: candidate,
        })
    }

    /// The band rose above its threshold in one of the last two analyses (a wide hit's check).
    pub fn active(&self) -> bool {
        self.last[0] > self.thresholds[0] || self.last[1] > self.thresholds[1]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOP: f32 = 256.0 / 48_000.0;

    #[test]
    fn a_lone_peak_is_a_hit_one_analysis_later_with_full_velocity() {
        let mut o = Onset::new(HOP, 0.1, 0.2);
        let mut hits = Vec::new();
        for (i, f) in [0.0, 0.0, 0.5, 2.0, 1.0, 0.2, 0.0].into_iter().enumerate() {
            if let Some(p) = o.push(f, f) {
                hits.push((i, p));
            }
        }
        assert_eq!(hits.len(), 1, "{hits:?}");
        assert_eq!(hits[0].0, 4, "the peak at 3, confirmed at 4");
        assert!((hits[0].1.velocity - 1.0).abs() < 1e-6);
    }

    #[test]
    fn the_refractory_time_and_the_floor_hold_hits_back() {
        let mut o = Onset::new(HOP, 0.1, 0.2);
        let mut count = 0;
        // A peak every 4 analyses (21 ms) for a second: at most one per 100 ms.
        for i in 0..188 {
            let f = if i % 4 == 0 { 2.0 } else { 0.0 };
            count += usize::from(o.push(f, f).is_some());
        }
        assert!((9..=11).contains(&count), "{count}");
        let mut quiet = Onset::new(HOP, 0.1, 0.2);
        let small = (0..100).filter(|i| {
            let f = if i % 20 == 0 { 0.15 } else { 0.0 };
            quiet.push(f, f).is_some()
        });
        assert_eq!(small.count(), 0, "under the floor");
    }

    #[test]
    fn a_higher_sensitivity_finds_softer_hits() {
        let run = |sense: f32| {
            let mut o = Onset::new(HOP, 0.05, 0.2);
            o.set_sensitivity(sense);
            (0..400)
                .filter(|i| {
                    let f = match i % 40 {
                        0 => 2.0,
                        20 => 0.3,
                        _ => 0.0,
                    };
                    o.push(f, f).is_some()
                })
                .count()
        };
        assert!(run(2.0) > run(1.0), "{} {}", run(2.0), run(1.0));
        assert!(run(0.5) <= run(1.0));
    }

    #[test]
    fn a_falling_band_or_one_no_louder_than_its_second_has_no_hit() {
        // A flux peak while the band's level goes down: a decay wavering, not a hit.
        let mut o = Onset::new(HOP, 0.05, 0.2);
        let mut found = 0;
        for i in 0..40 {
            let f = if i == 20 { 1.0 } else { 0.0 };
            found += usize::from(o.push(f, 1.0 - 0.02 * i as f32).is_some());
        }
        assert_eq!(found, 0);
        // A steady band: a flux peak with a level just at its mean is no kick.
        let mut kick = Onset::new(HOP, 0.05, 0.2).kick(1.4, SHARE);
        let mut found = 0;
        for i in 0..400 {
            let (f, level) = if i % 50 == 25 { (1.0, 1.3) } else { (0.0, 1.0) };
            found += usize::from(kick.push(f, level).is_some());
        }
        assert_eq!(found, 0);
    }
}
