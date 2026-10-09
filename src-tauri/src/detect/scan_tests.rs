use std::sync::Mutex;

use super::*;
use crate::config::apps::{AppSource, Art, Launch, MatchRule};
use crate::detect::{DetectError, ScanCtx};

struct Fake {
    kind: SourceKind,
    behaviour: Behaviour,
}

enum Behaviour {
    Apps(Vec<DetectedApp>),
    Error,
    Panic,
    WaitForCancel,
}

impl DetectSource for Fake {
    fn kind(&self) -> SourceKind {
        self.kind
    }

    fn scan(&self, ctx: &ScanCtx) -> Result<Vec<DetectedApp>, DetectError> {
        match &self.behaviour {
            Behaviour::Apps(a) => Ok(a.clone()),
            Behaviour::Error => Err(DetectError("disk on fire".into())),
            Behaviour::Panic => panic!("boom"),
            Behaviour::WaitForCancel => {
                while !ctx.cancelled() {
                    std::thread::yield_now();
                }
                Ok(Vec::new())
            }
        }
    }
}

fn steam_app(id: &str) -> DetectedApp {
    DetectedApp {
        id: format!("steam-{id}"),
        name: format!("Game {id}"),
        source: AppSource::Steam { app_id: id.into() },
        launch: Launch::Uri {
            uri: format!("steam://rungameid/{id}"),
        },
        match_rule: MatchRule::default(),
        poster_path: None,
        hero_path: None,
        already_added: false,
        suggested_category: String::new(),
    }
}

fn entry_for(app: &DetectedApp) -> AppEntry {
    AppEntry {
        id: app.id.clone(),
        name: app.name.clone(),
        category: "jeux".into(),
        source: app.source.clone(),
        launch: app.launch.clone(),
        match_rule: MatchRule::default(),
        art: Art::default(),
        mood_id: None,
        favorite: false,
    }
}

fn boxed(kind: SourceKind, behaviour: Behaviour) -> Box<dyn DetectSource> {
    Box::new(Fake { kind, behaviour })
}

#[test]
fn a_failing_source_does_not_stop_the_others() {
    let sources = vec![
        boxed(SourceKind::Steam, Behaviour::Apps(vec![steam_app("1")])),
        boxed(SourceKind::Epic, Behaviour::Error),
        boxed(SourceKind::Startmenu, Behaviour::Panic),
    ];
    let events = Mutex::new(Vec::new());
    let report = run_scan(&sources, &[], &CancelToken::default(), &|e| {
        events.lock().unwrap().push((e.source, e.state));
    });
    assert_eq!(report.sources.len(), 3);
    assert_eq!(report.sources[0].apps.len(), 1);
    assert!(report.sources[0].error.is_none());
    assert_eq!(report.sources[1].error.as_deref(), Some("disk on fire"));
    assert!(report.sources[2].error.is_some());
    let events = events.into_inner().unwrap();
    assert!(events.contains(&(SourceKind::Epic, ScanState::Failed)));
    assert!(events.contains(&(SourceKind::Steam, ScanState::Done)));
    assert!(events.contains(&(SourceKind::Steam, ScanState::Started)));
}

#[test]
fn already_added_is_marked_from_the_existing_apps() {
    let (one, two) = (steam_app("1"), steam_app("2"));
    let existing = [entry_for(&one)];
    let sources = vec![boxed(SourceKind::Steam, Behaviour::Apps(vec![one, two]))];
    let report = run_scan(&sources, &existing, &CancelToken::default(), &|_| {});
    let flags: Vec<_> = report.sources[0]
        .apps
        .iter()
        .map(|a| a.already_added)
        .collect();
    assert_eq!(flags, [true, false]);
}

#[test]
fn a_running_scan_can_be_cancelled() {
    let sources = vec![boxed(SourceKind::Steam, Behaviour::WaitForCancel)];
    let cancel = CancelToken::default();
    let canceller = cancel.clone();
    let report = std::thread::scope(|s| {
        s.spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(30));
            canceller.cancel();
        });
        run_scan(&sources, &[], &cancel, &|_| {})
    });
    assert!(report.cancelled);
}

#[test]
fn starting_a_scan_cancels_the_previous_one() {
    let state = DetectState::default();
    let first = state.begin();
    let second = state.begin();
    assert!(first.is_cancelled() && !second.is_cancelled());
    state.cancel();
    assert!(second.is_cancelled());
    state.finish(&second);
    state.cancel(); // nothing running: no effect, no panic
}

/// Real machine, read-only. Run by hand: `cargo test -p hub real_machine -- --ignored --nocapture`.
#[test]
#[ignore]
fn real_machine_scan_with_timings() {
    for run in 1..=3 {
        let report = run_scan(
            &crate::detect::default_sources(),
            &[],
            &CancelToken::default(),
            &|_| {},
        );
        println!("--- run {run}: total {} ms", report.total_ms);
        for s in &report.sources {
            println!(
                "{:?}: {} apps, {} skipped, {} ms, error {:?}",
                s.source,
                s.apps.len(),
                s.skipped,
                s.ms,
                s.error
            );
            if run == 1 {
                for a in &s.apps {
                    println!(
                        "    {} | {} | poster {}",
                        a.id,
                        a.name,
                        a.poster_path.is_some()
                    );
                }
            }
        }
    }
}
