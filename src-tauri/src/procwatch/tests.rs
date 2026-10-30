use std::sync::mpsc::{channel, Receiver};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use super::*;
use crate::config::apps::{AppSource, Art, Launch, MatchRule};

fn app(id: &str, launch: Launch, exe: Option<&str>) -> AppEntry {
    AppEntry {
        id: id.into(),
        name: id.into(),
        category: "jeux".into(),
        source: AppSource::Manual,
        launch,
        match_rule: MatchRule {
            exe: exe.map(Into::into),
        },
        art: Art::default(),
        mood_id: None,
        favorite: false,
        colors: None,
        mood_tune: None,
    }
}

fn exe_launch(path: &str) -> Launch {
    Launch::Exe {
        path: path.into(),
        args: vec![],
        cwd: None,
        elevated: false,
    }
}

fn proc(pid: u32, name: &str, exe: Option<&str>) -> ProcInfo {
    ProcInfo {
        pid,
        name: name.into(),
        exe: exe.map(Into::into),
    }
}

#[test]
fn match_exe_is_compared_by_name_ignoring_case() {
    let apps = [app(
        "mc",
        exe_launch(r"C:\g\launcher.exe"),
        Some("javaw.exe"),
    )];
    let procs = [
        proc(10, "JAVAW.EXE", None),
        proc(11, "other.exe", None),
        proc(12, "javaw.exe", None),
    ];
    let out = compute_states(&apps, &procs, None);
    assert_eq!(out.len(), 1);
    assert!(out[0].0.running && !out[0].0.foreground);
    assert_eq!(out[0].1, vec![10, 12]);
}

#[test]
fn without_match_exe_a_plain_program_falls_back_to_its_path() {
    let apps = [app("a", exe_launch(r"C:\Games\A.exe"), None)];
    let procs = [
        proc(1, "A.exe", Some(r"c:\games\a.exe")),
        proc(2, "A.exe", Some(r"D:\elsewhere\A.exe")),
        proc(3, "A.exe", None),
    ];
    let out = compute_states(&apps, &procs, None);
    assert_eq!(out[0].1, vec![1]);
}

#[test]
fn links_and_shortcuts_without_match_are_not_followed() {
    let apps = [
        app(
            "steam",
            Launch::Uri {
                uri: "steam://rungameid/1".into(),
            },
            None,
        ),
        app(
            "lnk",
            Launch::Lnk {
                path: r"C:\a.lnk".into(),
            },
            None,
        ),
        app(
            "web",
            Launch::Url {
                url: "https://example.org".into(),
            },
            None,
        ),
        app(
            "lnk-matched",
            Launch::Lnk {
                path: r"C:\b.lnk".into(),
            },
            Some("b.exe"),
        ),
    ];
    let out = compute_states(&apps, &[proc(1, "b.exe", None)], None);
    let ids: Vec<_> = out.iter().map(|(s, _)| s.id.as_str()).collect();
    assert_eq!(ids, ["lnk-matched"]);
}

#[test]
fn foreground_is_true_only_for_one_of_the_apps_processes() {
    let apps = [
        app("a", exe_launch(r"C:\a.exe"), Some("a.exe")),
        app("b", exe_launch(r"C:\b.exe"), Some("b.exe")),
    ];
    let procs = [proc(1, "a.exe", None), proc(2, "b.exe", None)];
    let out = compute_states(&apps, &procs, Some(2));
    assert!(!out[0].0.foreground && out[1].0.foreground);
    let none = compute_states(&apps, &procs, Some(99));
    assert!(none.iter().all(|(s, _)| !s.foreground));
}

#[test]
fn only_real_changes_are_reported() {
    let state = |id: &str, running, foreground| AppRunState {
        id: id.into(),
        running,
        foreground,
    };
    let mut prev = HashMap::new();
    prev.insert("a".to_string(), state("a", true, false));
    let next = [
        state("a", true, false),  // unchanged
        state("b", false, false), // first seen, idle: nothing to say
        state("c", true, true),   // first seen, running
    ];
    let out = processes::changed(&prev, &next);
    assert_eq!(out, vec![state("c", true, true)]);
    let out = processes::changed(&prev, &[state("a", true, true)]);
    assert_eq!(out.len(), 1);
}

struct FakeSource(Arc<Mutex<Vec<ProcInfo>>>);

impl ProcessSource for FakeSource {
    fn list(&mut self) -> Vec<ProcInfo> {
        self.0.lock().unwrap().clone()
    }
}

fn watch(procs: &Arc<Mutex<Vec<ProcInfo>>>) -> (ProcWatch, Receiver<AppRunState>) {
    let (tx, rx) = channel();
    let apps = vec![app("a", exe_launch(r"C:\a.exe"), Some("a.exe"))];
    let watch = ProcWatch::start(
        move || apps.clone(),
        Box::new(FakeSource(Arc::clone(procs))),
        || None,
        move |s| {
            let _ = tx.send(s);
        },
    );
    (watch, rx)
}

const SHORT: Duration = Duration::from_millis(300);
const LONG: Duration = Duration::from_secs(3);

#[test]
fn watcher_reports_start_and_stop_and_answers_apps_running() {
    let procs = Arc::new(Mutex::new(vec![]));
    let (watch, rx) = watch(&procs);
    assert!(rx.recv_timeout(SHORT).is_err(), "idle app: no event");

    procs.lock().unwrap().push(proc(5, "a.exe", None));
    watch.refresh();
    let started = rx.recv_timeout(LONG).unwrap();
    assert!(started.running);
    assert_eq!(watch.pids_of("a"), vec![5]);
    assert_eq!(watch.apps_running().len(), 1);

    procs.lock().unwrap().clear();
    watch.refresh();
    assert!(!rx.recv_timeout(LONG).unwrap().running);
    assert!(watch.pids_of("a").is_empty());
}

#[test]
fn paused_watcher_does_nothing_until_resumed() {
    let procs = Arc::new(Mutex::new(vec![]));
    let (watch, rx) = watch(&procs);
    watch.set_pace(Pace::Paused);
    // Let the first pass and the pace change go through before the process list changes.
    std::thread::sleep(Duration::from_millis(150));
    procs.lock().unwrap().push(proc(5, "a.exe", None));
    watch.refresh();
    assert!(rx.recv_timeout(SHORT).is_err(), "paused: no work");
    watch.set_pace(Pace::Idle);
    assert!(rx.recv_timeout(LONG).unwrap().running);
}
