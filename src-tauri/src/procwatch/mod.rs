//! Follows which configured apps are running and which one is in front.
//!
//! One thread, no polling loop of its own: it blocks on a channel and wakes up (a) when the
//! foreground hook reports a change, (b) when the pace timer expires, (c) on request. The pace
//! is slow at rest, quicker just after a launch, and `Paused` stops the timer entirely (the
//! sleep state of step 13). Only *changes* are reported.

pub mod folders;
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
    /// Whether the app can be followed at all (it has a way to recognise its process). An app
    /// that cannot be followed is never reported as running, so waiting for it is pointless.
    fn is_followed(&self, _id: &str) -> bool {
        true
    }
    /// Asks the main window of one of `pids` to close, never forcing anything.
    fn close_softly(&self, _pids: &[u32]) -> bool {
        false
    }
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

    /// Real system: `sysinfo` for processes, the Win32 hook for the foreground window, which
    /// also tells `on_foreground` (30/10: the launch cover, desktop/cover.rs).
    pub fn start_system(
        apps: impl Fn() -> Vec<AppEntry> + Send + 'static,
        emit: impl Fn(AppRunState) + Send + 'static,
        on_foreground: impl Fn(u32) + Send + Sync + 'static,
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
            on_foreground(pid);
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

    fn is_followed(&self, id: &str) -> bool {
        self.shared.lock().unwrap().states.contains_key(id)
    }

    fn close_softly(&self, pids: &[u32]) -> bool {
        window::post_close(pids)
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
    // Step 24: COM for reading shortcuts (folders.rs), for the thread's life.
    let _com = crate::detect::startmenu::Com::init()
        .map_err(|e| tracing::warn!(error = %e.0, "procwatch: no COM, shortcuts not followed"))
        .ok();
    // App id + what it launches → its folder (or none), found once per app.
    let mut found: HashMap<String, Option<String>> = HashMap::new();
    let mut folders: HashMap<String, String> = HashMap::new();

    loop {
        if publish {
            let started = Instant::now();
            if rescan {
                procs = source.list();
                fg_pid = foreground();
            }
            let list = apps();
            update_folders(&list, &mut found, &mut folders);
            publish_states(&shared, &list, &procs, fg_pid, &folders, &emit);
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

/// Looks up the folder of the apps not seen yet (folders.rs: files and shortcuts read once per
/// app, never again while it keeps the same launch); `folders` gets the apps that have one.
fn update_folders(
    apps: &[AppEntry],
    found: &mut HashMap<String, Option<String>>,
    folders: &mut HashMap<String, String>,
) {
    let mut changed = false;
    for app in apps {
        if app.match_rule.exe.is_some() {
            continue;
        }
        let key = format!("{}|{}", app.id, app.launch.target_key());
        if let std::collections::hash_map::Entry::Vacant(slot) = found.entry(key) {
            let folder = folders::install_folder(app);
            if let Some(f) = &folder {
                tracing::info!(app = %app.id, folder = %f, "procwatch: followed by its folder");
            }
            slot.insert(folder);
            changed = true;
        }
    }
    if changed {
        folders.clear();
        for app in apps {
            let key = format!("{}|{}", app.id, app.launch.target_key());
            if let Some(Some(f)) = found.get(&key) {
                folders.insert(app.id.clone(), f.clone());
            }
        }
    }
}

fn publish_states(
    shared: &Mutex<Shared>,
    apps: &[AppEntry],
    procs: &[ProcInfo],
    fg_pid: Option<u32>,
    folders: &HashMap<String, String>,
    emit: &impl Fn(AppRunState),
) {
    let computed = compute_states(apps, procs, fg_pid, folders);
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
