use super::*;
use crate::config::apps::{AppSource, Launch, MatchRule};
use crate::detect::DetectedApp;

fn app(id: &str, name: &str, source: AppSource) -> DetectedApp {
    DetectedApp {
        id: id.into(),
        name: name.into(),
        source,
        launch: Launch::Uri {
            uri: "x://y".into(),
        },
        match_rule: MatchRule::default(),
        poster_path: None,
        hero_path: None,
        already_added: false,
        suggested_category: String::new(),
        launcher: false,
        ignored: false,
        install_dir: None,
        logo_path: None,
    }
}

fn report(source: SourceKind, apps: Vec<DetectedApp>) -> SourceReport {
    SourceReport {
        source,
        apps,
        skipped: 0,
        error: None,
        ms: 0,
    }
}

fn steam(id: &str, name: &str) -> DetectedApp {
    app(
        &format!("steam-{id}"),
        name,
        AppSource::Steam { app_id: id.into() },
    )
}

fn menu(id: &str, name: &str) -> DetectedApp {
    app(&format!("menu-{id}"), name, AppSource::Manual)
}

#[test]
fn a_game_seen_by_steam_and_the_start_menu_is_proposed_once() {
    let mut twin = menu("a", "Hades II");
    twin.already_added = true;
    let mut reports = vec![
        report(
            SourceKind::Steam,
            vec![steam("1", "Hades II"), steam("2", "Celeste")],
        ),
        report(
            SourceKind::Startmenu,
            vec![twin, menu("b", "Discord"), menu("c", "CELESTE")],
        ),
    ];
    merge_twins(&mut reports);
    let names = |r: &SourceReport| r.apps.iter().map(|a| a.name.clone()).collect::<Vec<_>>();
    assert_eq!(names(&reports[0]), ["Hades II", "Celeste"]);
    assert_eq!(names(&reports[1]), ["Discord"]);
    // The shortcut was in the library: the Steam entry is not proposed as new.
    assert!(reports[0].apps[0].already_added);
    assert!(!reports[0].apps[1].already_added);
}

#[test]
fn stores_and_launchers_are_marked() {
    let mut reports = vec![report(
        SourceKind::Startmenu,
        vec![
            menu("a", "Steam"),
            menu("b", "Riot Client"),
            menu("c", "Discord"),
        ],
    )];
    mark_launchers(&mut reports);
    let flags: Vec<bool> = reports[0].apps.iter().map(|a| a.launcher).collect();
    assert_eq!(flags, [true, true, false]);
}

#[test]
fn ignored_apps_are_marked_by_id() {
    let mut scan = ScanReport {
        sources: vec![report(
            SourceKind::Startmenu,
            vec![menu("a", "A"), menu("b", "B")],
        )],
        total_ms: 0,
        cancelled: false,
    };
    mark_ignored(&mut scan, &["menu-b".into()]);
    let flags: Vec<bool> = scan.sources[0].apps.iter().map(|a| a.ignored).collect();
    assert_eq!(flags, [false, true]);
}
