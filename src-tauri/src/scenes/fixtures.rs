//! Fakes shared by the scene engine tests: simulated clock, fake process list, fixture.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde_json::{json, Value};

use super::action::Env;
use super::clock::{CancelToken, Clock};
use super::exec::{execute, RunSummary};
use super::*;
use crate::config::apps::{AppEntry, AppSource, Art, Launch, MatchRule};
use crate::config::scene::SceneFile;
use crate::launcher::fake::FakeLauncher;
use crate::procwatch::RunningApps;

pub const PID: u32 = 42;

pub struct FakeClock {
    pub time: Mutex<Duration>,
    /// At this simulated time, cancel the token (even in the middle of a sleep).
    pub cancel_at: Option<(Duration, CancelToken)>,
}

impl FakeClock {
    pub fn new() -> Self {
        Self {
            time: Mutex::default(),
            cancel_at: None,
        }
    }
}

impl Clock for FakeClock {
    fn now(&self) -> Duration {
        *self.time.lock().unwrap()
    }

    fn sleep(&self, d: Duration, cancel: &CancelToken) -> bool {
        if cancel.is_cancelled() {
            return false;
        }
        let mut time = self.time.lock().unwrap();
        let target = *time + d;
        if let Some((at, token)) = &self.cancel_at {
            if target >= *at {
                *time = (*at).max(*time);
                token.cancel();
                return false;
            }
        }
        *time = target;
        true
    }
}

#[derive(Default)]
pub struct FakeRunning {
    /// Apps that cannot be followed (no way to recognise their process).
    pub unfollowed: Vec<&'static str>,
    /// Apps already running.
    pub up: Vec<&'static str>,
    /// An app that shows up after this many looks at its processes.
    pub appears: Option<(&'static str, usize)>,
    pub looks: AtomicUsize,
    pub closed: Mutex<Vec<Vec<u32>>>,
    pub focused: Mutex<Vec<Vec<u32>>>,
}

impl RunningApps for FakeRunning {
    fn pids_of(&self, id: &str) -> Vec<u32> {
        if self.unfollowed.contains(&id) {
            return vec![];
        }
        let looks = self.looks.fetch_add(1, Ordering::Relaxed) + 1;
        let appeared = self.appears.is_some_and(|(a, n)| a == id && looks > n);
        if self.up.contains(&id) || appeared {
            vec![PID]
        } else {
            vec![]
        }
    }
    fn bring_to_front(&self, pids: &[u32]) -> bool {
        self.focused.lock().unwrap().push(pids.to_vec());
        true
    }
    fn note_launch(&self) {}
    fn is_followed(&self, id: &str) -> bool {
        !self.unfollowed.contains(&id)
    }
    fn close_softly(&self, pids: &[u32]) -> bool {
        self.closed.lock().unwrap().push(pids.to_vec());
        true
    }
}

pub fn app(id: &str) -> AppEntry {
    AppEntry {
        id: id.into(),
        name: id.to_uppercase(),
        category: "jeux".into(),
        source: AppSource::Manual,
        launch: Launch::Exe {
            path: format!(r"C:\Apps\{id}.exe"),
            args: vec![],
            cwd: None,
            elevated: false,
        },
        match_rule: MatchRule::default(),
        art: Art::default(),
        mood_id: None,
        favorite: false,
        colors: None,
        mood_tune: None,
    }
}

pub fn scene(steps: Value) -> SceneFile {
    serde_json::from_value(json!({"schemaVersion":1,"id":"test","name":"Test","steps":steps}))
        .unwrap()
}

/// Slots `a`, `b`, `c` → apps `app-a`…; slot `ghost` → an app that does not exist.
pub struct Fixture {
    pub launcher: FakeLauncher,
    pub running: FakeRunning,
    pub clock: FakeClock,
    pub token: CancelToken,
    pub apps: Vec<AppEntry>,
    pub slots: BTreeMap<String, String>,
    pub close_confirmed: bool,
}

impl Fixture {
    pub fn new() -> Self {
        let slots = [
            ("a", "app-a"),
            ("b", "app-b"),
            ("c", "app-c"),
            ("ghost", "gone"),
        ]
        .map(|(s, a)| (s.to_string(), a.to_string()))
        .into();
        Self {
            launcher: FakeLauncher::ok(1),
            running: FakeRunning::default(),
            clock: FakeClock::new(),
            token: CancelToken::default(),
            apps: vec![app("app-a"), app("app-b"), app("app-c")],
            slots,
            close_confirmed: false,
        }
    }

    pub fn run(&self, scene: &SceneFile) -> (RunSummary, Vec<ProgressUpdate>) {
        let env = Env {
            launcher: &self.launcher,
            running: &self.running,
            clock: &self.clock,
            cancel: &self.token,
            apps: &self.apps,
            slots: &self.slots,
            close_confirmed: self.close_confirmed,
        };
        let events = Mutex::new(Vec::new());
        let summary = execute(scene, 7, &env, &|e| {
            assert_eq!((e.run_id, e.scene_id.as_str()), (7, "test"));
            events.lock().unwrap().push(e.update);
        });
        (summary, events.into_inner().unwrap())
    }

    pub fn launched(&self) -> Vec<String> {
        self.launcher
            .calls()
            .iter()
            .map(|c| format!("{c:?}"))
            .collect()
    }
}
