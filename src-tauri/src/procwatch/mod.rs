//! Follows which configured apps are running and which one is in front.
//!
//! One thread, no polling loop of its own: it blocks on a channel and wakes up (a) when the
//! foreground hook reports a change, (b) when the pace timer expires, (c) on request. The pace
//! is slow at rest, quicker just after a launch, and `Paused` stops the timer entirely (the
//! sleep state of step 13). Only *changes* are reported.

pub mod processes;

use std::collections::HashMap;
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::config::apps::AppEntry;
use crate::platform::window;

pub use processes::{compute_states, AppRunState, ProcInfo, ProcessSource, SysinfoSource};

const IDLE: Duration = Duration::from_secs(2);
const ACTIVE: Duration = Duration::from_millis(750);
/// How long the quick pace lasts after a launch.
const BOOST: Duration = Duration::from_secs(30);
const STATS_EVERY: u32 = 100;

/// What the launcher needs to know about running apps (a fake in tests).
pub trait RunningApps: Send + Sync {
    fn pids_of(&self, id: &str) -> Vec<u32>;
    fn bring_to_front(&self, pids: &[u32]) -> bool;
    /// An app was just started: look more often for a while.
    fn note_launch(&self);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pace {
    /// Every 750 ms.
    Active,
    /// Every 2 s.
    Idle,
    /// No timer at all, no work until the pace changes.
    Paused,
}

enum Msg {
    Foreground(u32),
    SetPace(Pace),
    Refresh,
    Boost,
}

#[derive(Default)]
struct Shared {
    states: HashMap<String, AppRunState>,
    pids: HashMap<String, Vec<u32>>,
}

pub struct ProcWatch {
    tx: Sender<Msg>,
    shared: Arc<Mutex<Shared>>,
}

impl ProcWatch {
    /// Starts the watcher thread. `apps` gives the current app list on every pass, `foreground`
    /// the process in front, `emit` receives each changed state.
    pub fn start(
        apps: impl Fn() -> Vec<AppEntry> + Send + 'static,
        source: Box<dyn ProcessSource>,
        foreground: impl Fn() -> Option<u32> + Send + 'static,
        emit: impl Fn(AppRunState) + Send + 'static,
    ) -> Self {
        let (tx, rx) = channel();
        let shared = Arc::new(Mutex::new(Shared::default()));
        let state = Arc::clone(&shared);
        let spawned = std::thread::Builder::new()
            .name("procwatch".into())
            .spawn(move || run(rx, state, apps, source, foreground, emit));
        if let Err(e) = spawned {
            tracing::error!(error = %e, "procwatch thread could not start");
        }
        Self { tx, shared }
    }

    /// Real system: `sysinfo` for processes, the Win32 hook for the foreground window.
    pub fn start_system(
        apps: impl Fn() -> Vec<AppEntry> + Send + 'static,
        emit: impl Fn(AppRunState) + Send + 'static,
    ) -> Self {
        let watch = Self::start(
            apps,
            Box::new(SysinfoSource::new()),
            window::foreground_pid,
            emit,
        );
        let tx = watch.tx.clone();
        if let Err(e) = window::start_foreground_hook(move |pid| {
            let _ = tx.send(Msg::Foreground(pid));
        }) {
            // Not fatal: the foreground is also read on every pass.
            tracing::warn!(error = %e, "foreground hook unavailable, falling back to sampling");
        }
        watch
    }

    pub fn set_pace(&self, pace: Pace) {
        let _ = self.tx.send(Msg::SetPace(pace));
    }

    /// Look again now (the app list changed, or the window just came back).
    pub fn refresh(&self) {
        let _ = self.tx.send(Msg::Refresh);
    }

    /// Current state of every app that can be followed.
    pub fn apps_running(&self) -> Vec<AppRunState> {
        let mut all: Vec<_> = self
            .shared
            .lock()
            .unwrap()
            .states
            .values()
            .cloned()
            .collect();
        all.sort_by(|a, b| a.id.cmp(&b.id));
        all
    }
}

impl RunningApps for ProcWatch {
    fn pids_of(&self, id: &str) -> Vec<u32> {
        self.shared
            .lock()
            .unwrap()
            .pids
            .get(id)
            .cloned()
            .unwrap_or_default()
    }

    fn bring_to_front(&self, pids: &[u32]) -> bool {
        window::bring_to_front(pids)
    }

    fn note_launch(&self) {
        let _ = self.tx.send(Msg::Boost);
    }
}

fn run(
    rx: std::sync::mpsc::Receiver<Msg>,
    shared: Arc<Mutex<Shared>>,
    apps: impl Fn() -> Vec<AppEntry>,
    mut source: Box<dyn ProcessSource>,
    foreground: impl Fn() -> Option<u32>,
    emit: impl Fn(AppRunState),
) {
    let mut base = Pace::Idle;
    let mut boost_until: Option<Instant> = None;
    let mut procs: Vec<ProcInfo> = Vec::new();
    let mut fg_pid: Option<u32> = None;
    let (mut ticks, mut spent) = (0u32, Duration::ZERO);
    let mut rescan = true;
    let mut publish = true;

    loop {
        if publish {
            let started = Instant::now();
            if rescan {
                procs = source.list();
                fg_pid = foreground();
            }
            publish_states(&shared, &apps(), &procs, fg_pid, &emit);
            if rescan {
                ticks += 1;
                spent += started.elapsed();
                if ticks == STATS_EVERY {
                    tracing::info!(
                        avg_us = (spent / ticks).as_micros() as u64,
                        "procwatch: {ticks} passes"
                    );
                    (ticks, spent) = (0, Duration::ZERO);
                }
            }
        }
        (rescan, publish) = (false, false);

        let now = Instant::now();
        if boost_until.is_some_and(|t| t <= now) {
            boost_until = None;
        }
        let wait = match (base, boost_until) {
            (Pace::Paused, _) => None,
            (Pace::Active, _) | (_, Some(_)) => Some(ACTIVE),
            (Pace::Idle, None) => Some(IDLE),
        };
        let msg = match wait {
            Some(d) => rx.recv_timeout(d),
            None => rx.recv().map_err(|_| RecvTimeoutError::Disconnected),
        };
        match msg {
            Ok(Msg::Foreground(pid)) if base != Pace::Paused => {
                fg_pid = Some(pid);
                // A process we have not seen yet may be the one that just came forward.
                rescan = !procs.iter().any(|p| p.pid == pid);
                publish = true;
            }
            Ok(Msg::Foreground(_)) => {}
            Ok(Msg::SetPace(pace)) => {
                base = pace;
                (rescan, publish) = (pace != Pace::Paused, pace != Pace::Paused);
            }
            Ok(Msg::Refresh) => (rescan, publish) = (base != Pace::Paused, base != Pace::Paused),
            Ok(Msg::Boost) => boost_until = Some(Instant::now() + BOOST),
            Err(RecvTimeoutError::Timeout) => (rescan, publish) = (true, true),
            Err(RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn publish_states(
    shared: &Mutex<Shared>,
    apps: &[AppEntry],
    procs: &[ProcInfo],
    fg_pid: Option<u32>,
    emit: &impl Fn(AppRunState),
) {
    let computed = compute_states(apps, procs, fg_pid);
    let next: Vec<AppRunState> = computed.iter().map(|(s, _)| s.clone()).collect();
    let diff = {
        let mut shared = shared.lock().unwrap();
        let diff = processes::changed(&shared.states, &next);
        shared.pids = computed.into_iter().map(|(s, p)| (s.id, p)).collect();
        shared.states = next.into_iter().map(|s| (s.id.clone(), s)).collect();
        diff
    };
    for state in diff {
        emit(state);
    }
}

#[cfg(test)]
mod tests;
