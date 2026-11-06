//! Which of the configured apps are running, from a list of processes. The matching is pure
//! (no system calls) so it is tested with made-up process lists.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use specta::Type;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use super::folders::{norm, runs_from};
use crate::config::apps::{AppEntry, Launch};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcInfo {
    pub pid: u32,
    /// File name, e.g. `javaw.exe`.
    pub name: String,
    /// Full path of the executable, when Windows lets us read it.
    pub exe: Option<String>,
}

/// Where the process list comes from (the real system, or a fake in tests).
pub trait ProcessSource: Send {
    fn list(&mut self) -> Vec<ProcInfo>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppRunState {
    pub id: String,
    pub running: bool,
    /// One of the app's processes owns the window in front.
    pub foreground: bool,
}

/// `sysinfo` with the cheapest refresh that still gives names and (once per process) paths.
pub struct SysinfoSource {
    system: System,
}

impl SysinfoSource {
    pub fn new() -> Self {
        Self {
            system: System::new(),
        }
    }
}

impl Default for SysinfoSource {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessSource for SysinfoSource {
    fn list(&mut self) -> Vec<ProcInfo> {
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet),
        );
        self.system
            .processes()
            .iter()
            .map(|(pid, p)| ProcInfo {
                pid: pid.as_u32(),
                name: p.name().to_string_lossy().into_owned(),
                exe: p.exe().map(|e| e.to_string_lossy().into_owned()),
            })
            .collect()
    }
}

/// Process ids belonging to `app`, or `None` when the app cannot be followed.
///
/// 1. `match.exe`: any process with that file name (case-insensitive);
/// 2. otherwise, for a plain program, any process started from that exact path;
/// 3. otherwise, with a known folder (step 24: a Steam or Epic game, a shortcut's program), any
///    process started from that folder (`lower`: the processes' paths, normalised);
/// 4. otherwise (packaged app, web link, unknown folder…): not followed.
fn pids_for(
    app: &AppEntry,
    procs: &[ProcInfo],
    folder: Option<&str>,
    lower: &[Option<String>],
) -> Option<Vec<u32>> {
    let pick =
        |f: &dyn Fn(&ProcInfo) -> bool| procs.iter().filter(|p| f(p)).map(|p| p.pid).collect();
    if let Some(name) = &app.match_rule.exe {
        return Some(pick(&|p| p.name.eq_ignore_ascii_case(name)));
    }
    match &app.launch {
        Launch::Exe { path, .. } => Some(pick(&|p| {
            p.exe
                .as_deref()
                .is_some_and(|e| e.eq_ignore_ascii_case(path))
        })),
        _ => {
            let folder = folder?;
            Some(
                procs
                    .iter()
                    .zip(lower)
                    .filter(|(_, e)| e.as_deref().is_some_and(|e| runs_from(e, folder)))
                    .map(|(p, _)| p.pid)
                    .collect(),
            )
        }
    }
}

/// State of every followable app; each comes with its process ids (to bring a window forward).
/// `folders`: app id → its folder (folders.rs), for the apps followed by folder.
pub fn compute_states(
    apps: &[AppEntry],
    procs: &[ProcInfo],
    foreground_pid: Option<u32>,
    folders: &HashMap<String, String>,
) -> Vec<(AppRunState, Vec<u32>)> {
    // The paths in lower case once per pass, only when some app is followed by folder.
    let lower: Vec<Option<String>> = if folders.is_empty() {
        Vec::new()
    } else {
        procs.iter().map(|p| p.exe.as_deref().map(norm)).collect()
    };
    apps.iter()
        .filter_map(|app| {
            let folder = folders.get(&app.id).map(String::as_str);
            let pids = pids_for(app, procs, folder, &lower)?;
            let state = AppRunState {
                id: app.id.clone(),
                running: !pids.is_empty(),
                foreground: foreground_pid.is_some_and(|f| pids.contains(&f)),
            };
            Some((state, pids))
        })
        .collect()
}

/// The states that differ from `previous` (an app seen for the first time counts as changed
/// unless it is simply «not running, not in front»).
pub fn changed(previous: &HashMap<String, AppRunState>, next: &[AppRunState]) -> Vec<AppRunState> {
    next.iter()
        .filter(|s| match previous.get(&s.id) {
            Some(old) => old != *s,
            None => s.running || s.foreground,
        })
        .cloned()
        .collect()
}
