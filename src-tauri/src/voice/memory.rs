//! « Kayro apprend de vous » (step 21, the user's idea of 2026-11-04): reinforcement in its light,
//! rule-bound form. What the user says to name an app or a scene (« mon jeu de foot », « disco »
//! as their voice gets written) is linked to what came of it: a launch that stays is rewarded
//! (+1), a choice made in a doubt even more (+2), a spoken « ferme X » soon after Kayro launched X
//! is a « not that one » (−2). A link with a positive score is used before any guess. It only ever
//! points to an app or a scene of the configuration (checked each time): it can never start
//! anything else. Kept in `%APPDATA%/Kayro/voice-memory.json` (the target part of a command, not
//! the sentence); « Oublier » in Réglages empties it.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use super::command::Target;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Link {
    said: String,
    scene: bool,
    id: String,
    score: i32,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Memory {
    schema_version: u32,
    links: Vec<Link>,
    /// What the user launches by voice at each time of day (`habits`).
    habits: Vec<Habit>,
}

/// An app or a scene, how often launched by voice at night (0–5 h), in the morning (6–11), the
/// afternoon (12–17) and the evening (18–23).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Habit {
    scene: bool,
    id: String,
    by_time: [u32; 4],
}

const SCHEMA: u32 = 1;
/// At most this many links (the oldest weakest go first).
const MAX_LINKS: usize = 400;
const MAX_SCORE: i32 = 20;
/// « Ferme X » this soon after Kayro launched X by voice: it was not the right one.
const REGRET: Duration = Duration::from_secs(30);
/// A sentence that led nowhere, then another one that worked this soon: they meant the same.
const REPHRASE: Duration = Duration::from_secs(20);
/// A doubt is settled by habit only for a target launched this often at this time of day, and
/// this many times more than any other of the doubt.
const HABIT_MIN: u32 = 4;
const HABIT_LEAD: u32 = 3;
const MAX_HABITS: usize = 200;

struct State {
    memory: Option<Memory>,
    /// The last launch by voice: what was said, what was launched, when.
    last: Option<(String, Target, Instant)>,
    /// The last sentence that led nowhere (not understood, a doubt left, a launch regretted).
    missed: Option<(String, Instant)>,
}

static STATE: Mutex<State> = Mutex::new(State {
    memory: None,
    last: None,
    missed: None,
});

fn path() -> std::path::PathBuf {
    crate::paths::data_dir().join("voice-memory.json")
}

fn with<T>(f: impl FnOnce(&mut Memory, &mut Option<(String, Target, Instant)>) -> T) -> T {
    let mut s = STATE.lock().unwrap_or_else(|p| p.into_inner());
    let State { memory, last, .. } = &mut *s;
    let m = memory.get_or_insert_with(|| {
        std::fs::read(path())
            .ok()
            .and_then(|b| serde_json::from_slice::<Memory>(&b).ok())
            .filter(|m| m.schema_version == SCHEMA)
            .unwrap_or(Memory {
                schema_version: SCHEMA,
                links: Vec::new(),
                habits: Vec::new(),
            })
    });
    f(m, last)
}

fn save(m: &Memory) {
    match serde_json::to_vec_pretty(m) {
        Ok(bytes) => {
            if let Err(e) = crate::config::atomic::write_atomic(&path(), &bytes) {
                tracing::warn!(error = %e, "voice: memory not saved");
            }
        }
        Err(e) => tracing::warn!(error = %e, "voice: memory not written"),
    }
}

fn of(t: &Target) -> (bool, &str) {
    match t {
        Target::App(id) => (false, id),
        Target::Scene(id) => (true, id),
    }
}

/// What `said` (normalized, as the command parser keeps it) pointed to before, if it worked.
pub fn recall(said: &str) -> Option<Target> {
    if said.is_empty() {
        return None;
    }
    with(|m, _| {
        m.links
            .iter()
            .filter(|l| l.said == said && l.score > 0)
            .max_by_key(|l| l.score)
            .map(|l| {
                if l.scene {
                    Target::Scene(l.id.clone())
                } else {
                    Target::App(l.id.clone())
                }
            })
    })
}

impl Memory {
    /// Rewards (or, negative, punishes) the link `said` → `target`.
    fn reward(&mut self, said: &str, target: &Target, delta: i32) {
        let (scene, id) = of(target);
        match self
            .links
            .iter_mut()
            .find(|l| l.said == said && l.scene == scene && l.id == id)
        {
            Some(l) => l.score = (l.score + delta).min(MAX_SCORE),
            None if delta > 0 => self.links.push(Link {
                said: said.to_string(),
                scene,
                id: id.to_string(),
                score: delta,
            }),
            None => {}
        }
        self.links.retain(|l| l.score > -5);
        if self.links.len() > MAX_LINKS {
            self.links.sort_by_key(|l| std::cmp::Reverse(l.score));
            self.links.truncate(MAX_LINKS);
        }
    }

    fn habit(&mut self, target: &Target, slot: usize) {
        let (scene, id) = of(target);
        match self
            .habits
            .iter_mut()
            .find(|h| h.scene == scene && h.id == id)
        {
            Some(h) => h.by_time[slot] = h.by_time[slot].saturating_add(1),
            None => {
                let mut by_time = [0; 4];
                by_time[slot] = 1;
                self.habits.push(Habit {
                    scene,
                    id: id.to_string(),
                    by_time,
                });
            }
        }
        if self.habits.len() > MAX_HABITS {
            self.habits
                .sort_by_key(|h| std::cmp::Reverse(h.by_time.iter().sum::<u32>()));
            self.habits.truncate(MAX_HABITS);
        }
    }

    /// The candidate launched by far the most at this time of day, unless `said` was said for
    /// it before and regretted.
    fn prefer(&self, said: &str, candidates: &[Target], slot: usize) -> Option<Target> {
        let regretted = |t: &Target| {
            let (scene, id) = of(t);
            self.links
                .iter()
                .any(|l| l.said == said && l.scene == scene && l.id == id && l.score < 0)
        };
        let count = |t: &Target| {
            let (scene, id) = of(t);
            self.habits
                .iter()
                .find(|h| h.scene == scene && h.id == id)
                .map_or(0, |h| h.by_time[slot])
        };
        let mut ranked: Vec<(u32, &Target)> = candidates
            .iter()
            .filter(|t| !regretted(t))
            .map(|t| (count(t), t))
            .collect();
        ranked.sort_by_key(|(n, _)| std::cmp::Reverse(*n));
        let (best, target) = *ranked.first()?;
        let second = ranked.get(1).map_or(0, |r| r.0);
        (best >= HABIT_MIN && best >= HABIT_LEAD * second.max(1)).then(|| target.clone())
    }
}

/// Rewards (or, negative, punishes) the link `said` → `target`.
pub fn reward(said: &str, target: &Target, delta: i32) {
    if said.is_empty() {
        return;
    }
    with(|m, _| {
        m.reward(said, target, delta);
        save(m);
    });
}

fn time_of_day(hour: u8) -> usize {
    usize::from(hour.min(23) / 6)
}

fn missed() -> Option<(String, Instant)> {
    STATE
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .missed
        .take()
}

/// A sentence that led nowhere (not understood, a doubt left unanswered): if the next one,
/// soon after, launches something, both meant it (« ouvre mon jeu de bagnole » … « lance
/// Forza »).
pub fn led_nowhere(said: &str) {
    if !said.is_empty() {
        let mut s = STATE.lock().unwrap_or_else(|p| p.into_inner());
        s.missed = Some((said.into(), Instant::now()));
    }
}

/// A launch by voice: rewarded now, remembered a moment in case it gets closed at once; what was
/// said just before and led nowhere now points here too; the habit of the time of day grows.
pub fn launched(said: &str, target: Target) {
    let before = missed().filter(|(b, at)| at.elapsed() < REPHRASE && b != said);
    let slot = time_of_day(crate::platform::local_hour());
    with(|m, last| {
        if !said.is_empty() {
            m.reward(said, &target, 1);
        }
        if let Some((before, _)) = &before {
            m.reward(before, &target, 2);
        }
        m.habit(&target, slot);
        save(m);
        *last = Some((said.to_string(), target, Instant::now()));
    });
}

/// Several sound alike: the one the user launches by far the most at this time of day (`None`:
/// ask).
pub fn prefer(said: &str, candidates: &[Target]) -> Option<Target> {
    let slot = time_of_day(crate::platform::local_hour());
    with(|m, _| m.prefer(said, candidates, slot))
}

/// A spoken « ferme X »: if Kayro launched X by voice just before, that was not the right one.
pub fn closed(id: &str) {
    let regret = with(|_, last| match last.take() {
        Some((said, target, at)) if at.elapsed() < REGRET && of(&target).1 == id => {
            Some((said, target))
        }
        other => {
            *last = other;
            None
        }
    });
    if let Some((said, target)) = regret {
        reward(&said, &target, -2);
        // The next launch, soon, is what was meant.
        led_nowhere(&said);
    }
}

pub fn count() -> usize {
    with(|m, _| m.links.iter().filter(|l| l.score > 0).count())
}

pub fn forget() {
    with(|m, last| {
        m.links.clear();
        m.habits.clear();
        *last = None;
        save(m);
    });
    missed();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory() -> Memory {
        Memory {
            schema_version: SCHEMA,
            links: Vec::new(),
            habits: Vec::new(),
        }
    }

    fn app(id: &str) -> Target {
        Target::App(id.into())
    }

    #[test]
    fn the_time_of_day_is_one_of_four() {
        assert_eq!(
            [0, 5, 6, 11, 12, 17, 18, 23].map(time_of_day),
            [0, 0, 1, 1, 2, 2, 3, 3]
        );
    }

    #[test]
    fn a_doubt_is_settled_only_by_a_clear_habit() {
        let mut m = memory();
        let both = [app("elden"), app("eldorado")];
        for _ in 0..3 {
            m.habit(&app("elden"), 3);
        }
        assert_eq!(m.prefer("elden", &both, 3), None, "too few launches yet");
        m.habit(&app("elden"), 3);
        assert_eq!(m.prefer("elden", &both, 3), Some(app("elden")));
        assert_eq!(m.prefer("elden", &both, 1), None, "another time of day");
        for _ in 0..2 {
            m.habit(&app("eldorado"), 3);
        }
        assert_eq!(
            m.prefer("elden", &both, 3),
            None,
            "the other one is used too"
        );
    }

    #[test]
    fn a_regretted_target_is_never_preferred() {
        let mut m = memory();
        for _ in 0..8 {
            m.habit(&app("elden"), 2);
        }
        let both = [app("elden"), app("eldorado")];
        m.reward("mon jeu", &app("elden"), 1);
        m.reward("mon jeu", &app("elden"), -2);
        assert_eq!(m.prefer("mon jeu", &both, 2), None);
        assert_eq!(m.prefer("elden", &both, 2), Some(app("elden")));
    }

    #[test]
    fn rewards_add_up_and_a_bad_link_goes() {
        let mut m = memory();
        m.reward("disco", &app("discord"), 2);
        m.reward("disco", &app("discord"), 1);
        assert_eq!(m.links[0].score, 3);
        m.reward("disco", &app("discord"), -9);
        assert!(m.links.is_empty());
        m.reward("nouveau", &app("x"), -2);
        assert!(m.links.is_empty(), "a punishment alone makes no link");
    }
}
