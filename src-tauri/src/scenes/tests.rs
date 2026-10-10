//! Tests of the scene engine.

use std::sync::mpsc::channel;
use std::time::{Duration, Instant};

use serde_json::json;

use super::action::Env;
use super::clock::Clock;
use super::clock::RealClock;
use super::exec::{execute, RunSummary};
use super::fixtures::*;
use super::*;
use crate::error::ErrorCode;
use crate::launcher::fake::FakeLauncher;
use crate::launcher::LaunchError;

use StepState::{Failed, Ok as Done, Skipped};

fn states(summary: &RunSummary) -> Vec<StepState> {
    summary.steps.iter().map(|s| s.0).collect()
}

#[test]
fn steps_run_in_order_and_report_each_state() {
    let mut f = Fixture::new();
    f.running.appears = Some(("app-b", 2));
    let s = scene(json!([
        {"type":"launch","slot":"a"},
        {"type":"wait","ms":2000},
        {"type":"launch","slot":"b"},
        {"type":"waitReady","slot":"b","timeoutMs":30000},
        {"type":"focus","slot":"b"}
    ]));
    let (summary, events) = f.run(&s);
    assert_eq!(summary.status, RunStatus::Completed);
    assert_eq!(states(&summary), vec![Done; 5]);
    let launched = f.launched();
    assert!(launched[0].contains("app-a.exe") && launched[1].contains("app-b.exe"));
    assert_eq!(launched.len(), 2);
    assert_eq!(f.running.focused.lock().unwrap().len(), 1);
    assert!(f.clock.now() >= Duration::from_millis(2000));

    // Started, then Running + final for each step, then Finished.
    assert_eq!(events.first(), Some(&ProgressUpdate::Started { total: 5 }));
    assert_eq!(events.len(), 1 + 5 * 2 + 1);
    assert_eq!(
        events[1],
        ProgressUpdate::Step {
            index: 0,
            state: StepState::Running,
            reason: None
        }
    );
    assert_eq!(
        events[2],
        ProgressUpdate::Step {
            index: 0,
            state: Done,
            reason: None
        }
    );
    assert_eq!(
        events.last(),
        Some(&ProgressUpdate::Finished {
            status: RunStatus::Completed
        })
    );
}

#[test]
fn cancelling_during_a_wait_stops_at_once_and_skips_the_rest() {
    let mut f = Fixture::new();
    f.clock.cancel_at = Some((Duration::from_millis(1500), f.token.clone()));
    let s = scene(json!([
        {"type":"launch","slot":"a"},
        {"type":"wait","ms":60000},
        {"type":"launch","slot":"b"}
    ]));
    let (summary, events) = f.run(&s);
    assert_eq!(summary.status, RunStatus::Cancelled);
    assert_eq!(
        summary.steps,
        vec![
            (Done, None),
            (Skipped, Some(Reason::Cancelled)),
            (Skipped, Some(Reason::Cancelled))
        ]
    );
    assert_eq!(f.launched().len(), 1, "nothing starts after the cancel");
    assert_eq!(f.clock.now(), Duration::from_millis(1500));
    assert_eq!(
        events.last(),
        Some(&ProgressUpdate::Finished {
            status: RunStatus::Cancelled
        })
    );
}

#[test]
fn cancelling_during_wait_ready_stops_the_polling() {
    let mut f = Fixture::new();
    f.clock.cancel_at = Some((Duration::from_millis(600), f.token.clone()));
    let s = scene(json!([
        {"type":"waitReady","slot":"a","timeoutMs":30000},
        {"type":"launch","slot":"b"}
    ]));
    let (summary, _) = f.run(&s);
    assert_eq!(summary.status, RunStatus::Cancelled);
    assert_eq!(states(&summary), vec![Skipped, Skipped]);
    assert!(f.launched().is_empty());
}

#[test]
fn wait_ready_times_out_and_a_plain_failure_does_not_stop_the_scene() {
    let f = Fixture::new();
    let s = scene(json!([
        {"type":"waitReady","slot":"a","timeoutMs":30000},
        {"type":"launch","slot":"b"}
    ]));
    let (summary, _) = f.run(&s);
    assert_eq!(summary.steps[0], (Failed, Some(Reason::Timeout)));
    assert_eq!(summary.steps[1], (Done, None));
    assert_eq!(summary.status, RunStatus::Completed);
    let waited = f.clock.now();
    assert!(waited >= Duration::from_secs(30) && waited < Duration::from_millis(30_300));
}

#[test]
fn a_required_failure_aborts_the_rest() {
    let mut f = Fixture::new();
    f.launcher = FakeLauncher::answering(Err(LaunchError::NotFound));
    let s = scene(json!([
        {"type":"launch","slot":"a","required":true},
        {"type":"launch","slot":"b"},
        {"type":"wait","ms":10}
    ]));
    let (summary, _) = f.run(&s);
    assert_eq!(summary.status, RunStatus::Failed);
    assert_eq!(
        summary.steps,
        vec![
            (Failed, Some(Reason::LaunchNotFound)),
            (Skipped, Some(Reason::Aborted)),
            (Skipped, Some(Reason::Aborted))
        ]
    );
    assert_eq!(f.launched().len(), 1);

    // The same failure without `required` lets the scene go on.
    let s = scene(json!([
        {"type":"launch","slot":"a"},
        {"type":"launch","slot":"b"}
    ]));
    let (summary, _) = f.run(&s);
    assert_eq!(summary.status, RunStatus::Completed);
    assert_eq!(states(&summary), vec![Failed, Failed]);
}

#[test]
fn an_unlinked_slot_is_skipped_and_reported_even_when_required() {
    let f = Fixture::new();
    let s = scene(json!([
        {"type":"launch","slot":"nowhere","required":true},
        {"type":"launch","slot":"ghost"},
        {"type":"launch","slot":"a"}
    ]));
    let (summary, events) = f.run(&s);
    assert_eq!(summary.status, RunStatus::Completed);
    assert_eq!(
        summary.steps,
        vec![
            (Skipped, Some(Reason::SlotUnlinked)),
            (Skipped, Some(Reason::SlotUnlinked)),
            (Done, None)
        ]
    );
    assert_eq!(f.launched().len(), 1);
    assert!(events.contains(&ProgressUpdate::Step {
        index: 0,
        state: Skipped,
        reason: Some(Reason::SlotUnlinked)
    }));
}

#[test]
fn close_is_refused_without_confirmation_and_never_forced() {
    let mut f = Fixture::new();
    f.running.up = vec!["app-a"];
    let s = scene(json!([{"type":"close","slot":"a"}]));
    let (summary, _) = f.run(&s);
    assert_eq!(
        summary.steps[0],
        (Failed, Some(Reason::ConfirmationRequired))
    );
    assert!(f.running.closed.lock().unwrap().is_empty());

    f.close_confirmed = true;
    let (summary, _) = f.run(&s);
    assert_eq!(summary.steps[0], (Done, None));
    assert_eq!(*f.running.closed.lock().unwrap(), vec![vec![PID]]);
}

#[test]
fn close_focus_and_wait_ready_handle_apps_that_are_absent_or_not_followed() {
    let mut f = Fixture::new();
    f.close_confirmed = true;
    f.running.unfollowed = vec!["app-b"];
    let s = scene(json!([
        {"type":"close","slot":"a"},
        {"type":"focus","slot":"a"},
        {"type":"close","slot":"b"},
        {"type":"focus","slot":"b"},
        {"type":"waitReady","slot":"b","timeoutMs":30000}
    ]));
    let (summary, _) = f.run(&s);
    assert_eq!(
        summary.steps,
        vec![
            (Skipped, Some(Reason::NotRunning)),
            (Failed, Some(Reason::NotRunning)),
            (Skipped, Some(Reason::NotFollowable)),
            (Skipped, Some(Reason::NotFollowable)),
            (Skipped, Some(Reason::NotFollowable)),
        ]
    );
    assert_eq!(
        f.clock.now(),
        Duration::ZERO,
        "no waiting for an app we cannot follow"
    );
    assert!(f.running.closed.lock().unwrap().is_empty());
}

#[test]
fn only_one_scene_plays_at_a_time_and_cancel_answers_within_200_ms() {
    let runner = SceneRunner::default();
    assert!(!runner.cancel(), "nothing to cancel");

    let (done_tx, done_rx) = channel();
    let (go_tx, go_rx) = channel::<()>();
    let long = scene(json!([{"type":"wait","ms":600000}]));
    let run_id = runner
        .start(move |run_id, token| {
            let f = Fixture::new();
            let env = Env {
                launcher: &f.launcher,
                running: &f.running,
                clock: &RealClock::new(),
                cancel: token,
                apps: &f.apps,
                slots: &f.slots,
                close_confirmed: false,
            };
            go_tx.send(()).unwrap();
            let summary = execute(&long, run_id, &env, &|_| {});
            done_tx.send(summary.status).unwrap();
        })
        .unwrap();
    go_rx.recv().unwrap();
    assert!(runner.is_playing());
    let busy = runner.start(|_, _| {}).unwrap_err();
    assert_eq!(busy.code, ErrorCode::Busy);

    std::thread::sleep(Duration::from_millis(100)); // let it get into the wait
    let asked = Instant::now();
    assert!(runner.cancel());
    let status = done_rx.recv_timeout(Duration::from_secs(2)).unwrap();
    let took = asked.elapsed();
    assert_eq!(status, RunStatus::Cancelled);
    assert!(took < Duration::from_millis(200), "cancel took {took:?}");

    // The slot frees up once the thread has finished.
    let deadline = Instant::now() + Duration::from_secs(2);
    while runner.is_playing() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(5));
    }
    assert!(!runner.is_playing());
    let next = runner.start(|_, _| {}).unwrap();
    assert!(next > run_id);
}
