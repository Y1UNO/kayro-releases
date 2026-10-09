use std::sync::Mutex;

use super::fake::FakeLauncher;
use super::*;
use crate::config::apps::{AppSource, Art, Launch, MatchRule};

fn entry(launch: Launch) -> AppEntry {
    AppEntry {
        id: "a".into(),
        name: "A".into(),
        category: "jeux".into(),
        source: AppSource::Manual,
        launch,
        match_rule: MatchRule::default(),
        art: Art::default(),
        mood_id: None,
        favorite: false,
    }
}

fn exe(elevated: bool) -> Launch {
    Launch::Exe {
        path: r"C:\Games\a.exe".into(),
        args: vec!["-x".into()],
        cwd: None,
        elevated,
    }
}

#[derive(Default)]
struct FakeRunning {
    pids: Vec<u32>,
    can_focus: bool,
    focused: Mutex<Vec<Vec<u32>>>,
    launches: Mutex<u32>,
}

impl RunningApps for FakeRunning {
    fn pids_of(&self, _id: &str) -> Vec<u32> {
        self.pids.clone()
    }
    fn bring_to_front(&self, pids: &[u32]) -> bool {
        self.focused.lock().unwrap().push(pids.to_vec());
        self.can_focus
    }
    fn note_launch(&self) {
        *self.launches.lock().unwrap() += 1;
    }
}

#[test]
fn win32_codes_are_classified() {
    let c = |n| LaunchError::classify(Win32Error(n));
    assert_eq!(c(2), LaunchError::NotFound);
    assert_eq!(c(3), LaunchError::NotFound);
    assert_eq!(c(1155), LaunchError::NotFound);
    assert_eq!(c(5), LaunchError::AccessDenied);
    assert_eq!(c(740), LaunchError::ElevationRequired);
    assert_eq!(c(1223), LaunchError::ElevationCancelled);
    assert_eq!(c(87), LaunchError::Other(87));
}

#[test]
fn errors_map_to_typed_codes() {
    let code = |e: LaunchError| AppError::from(e).code;
    assert_eq!(code(LaunchError::NotFound), ErrorCode::LaunchNotFound);
    assert_eq!(code(LaunchError::AccessDenied), ErrorCode::LaunchDenied);
    assert_eq!(
        code(LaunchError::ElevationRequired),
        ErrorCode::ElevationRequired
    );
    assert_eq!(
        code(LaunchError::ElevationCancelled),
        ErrorCode::ElevationCancelled
    );
    assert_eq!(
        code(LaunchError::Invalid("x".into())),
        ErrorCode::Validation
    );
    assert_eq!(code(LaunchError::Other(1)), ErrorCode::LaunchFailed);
}

#[test]
fn each_launch_kind_becomes_the_right_request() {
    let req = |l| LaunchRequest::from_entry(&entry(l)).unwrap();
    assert!(matches!(
        req(exe(false)),
        LaunchRequest::Exe {
            elevated: false,
            ..
        }
    ));
    assert!(matches!(
        req(exe(true)),
        LaunchRequest::Exe { elevated: true, .. }
    ));
    assert_eq!(
        req(Launch::Uri {
            uri: "steam://rungameid/1".into()
        }),
        LaunchRequest::Shell {
            target: "steam://rungameid/1".into()
        }
    );
    assert!(matches!(
        req(Launch::Lnk {
            path: r"C:\a.lnk".into()
        }),
        LaunchRequest::Shell { .. }
    ));
    assert!(matches!(
        req(Launch::Url {
            url: "https://example.org".into()
        }),
        LaunchRequest::Shell { .. }
    ));
    assert!(matches!(
        req(Launch::Uwp {
            aumid: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App".into()
        }),
        LaunchRequest::Uwp { .. }
    ));
}

#[test]
fn an_invalid_entry_never_reaches_the_launcher() {
    let launcher = FakeLauncher::ok(1);
    let running = FakeRunning::default();
    for bad in [
        Launch::Exe {
            path: "relative.exe".into(),
            args: vec![],
            cwd: None,
            elevated: false,
        },
        Launch::Exe {
            path: r"C:\a\..\b.exe".into(),
            args: vec![],
            cwd: None,
            elevated: false,
        },
        Launch::Uri {
            uri: "file:///C:/Windows/System32/cmd.exe".into(),
        },
        Launch::Uri {
            uri: "javascript://x".into(),
        },
        Launch::Url {
            url: "ftp://example.org".into(),
        },
        Launch::Lnk {
            path: r"C:\a.exe".into(),
        },
    ] {
        let r = launch_app(&launcher, &running, &entry(bad));
        assert!(matches!(r, Err(LaunchError::Invalid(_))), "{r:?}");
    }
    assert!(launcher.calls().is_empty());
}

#[test]
fn launching_reports_the_pid_and_wakes_the_watcher() {
    let launcher = FakeLauncher::ok(4242);
    let running = FakeRunning::default();
    let result = launch_app(&launcher, &running, &entry(exe(false))).unwrap();
    assert_eq!(result, LaunchResult::Started { pid: Some(4242) });
    assert_eq!(launcher.calls().len(), 1);
    assert_eq!(*running.launches.lock().unwrap(), 1);
}

#[test]
fn elevation_is_only_requested_when_configured() {
    let launcher = FakeLauncher::ok(1);
    let running = FakeRunning::default();
    launch_app(&launcher, &running, &entry(exe(false))).unwrap();
    launch_app(&launcher, &running, &entry(exe(true))).unwrap();
    let flags: Vec<bool> = launcher
        .calls()
        .iter()
        .map(|c| matches!(c, LaunchRequest::Exe { elevated: true, .. }))
        .collect();
    assert_eq!(flags, [false, true]);
}

#[test]
fn a_running_app_is_brought_forward_instead_of_started_again() {
    let launcher = FakeLauncher::ok(1);
    let running = FakeRunning {
        pids: vec![7, 8],
        can_focus: true,
        ..Default::default()
    };
    let result = launch_app(&launcher, &running, &entry(exe(false))).unwrap();
    assert_eq!(result, LaunchResult::FocusedExisting);
    assert!(launcher.calls().is_empty());
    assert_eq!(running.focused.lock().unwrap()[0], vec![7, 8]);
}

#[test]
fn a_running_app_without_a_reachable_window_is_started_normally() {
    // Typical for an app living in the tray: starting it again wakes the existing instance.
    let launcher = FakeLauncher::ok(1);
    let running = FakeRunning {
        pids: vec![7],
        can_focus: false,
        ..Default::default()
    };
    let result = launch_app(&launcher, &running, &entry(exe(false))).unwrap();
    assert_eq!(result, LaunchResult::Started { pid: Some(1) });
}

#[test]
fn launcher_errors_are_passed_on_and_do_not_wake_the_watcher() {
    let launcher = FakeLauncher::answering(Err(LaunchError::ElevationRequired));
    let running = FakeRunning::default();
    let r = launch_app(&launcher, &running, &entry(exe(false)));
    assert_eq!(r, Err(LaunchError::ElevationRequired));
    assert_eq!(*running.launches.lock().unwrap(), 0);
}

/// Real start of a harmless console program. `cargo test -- --ignored launcher`.
#[test]
#[ignore = "starts a real process"]
fn real_launcher_starts_a_console_program_and_gets_its_pid() {
    use super::system::SystemLauncher;
    let req = LaunchRequest::Exe {
        path: r"C:\Windows\System32\ping.exe".into(),
        args: vec!["-n".into(), "2".into(), "127.0.0.1".into()],
        cwd: None,
        elevated: false,
    };
    let out = SystemLauncher.launch(&req).unwrap();
    assert!(out.pid.is_some_and(|p| p > 0));
    let missing = LaunchRequest::Exe {
        path: r"C:\does\not\exist.exe".into(),
        args: vec![],
        cwd: None,
        elevated: false,
    };
    assert_eq!(SystemLauncher.launch(&missing), Err(LaunchError::NotFound));
}
