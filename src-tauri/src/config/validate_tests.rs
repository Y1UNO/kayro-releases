//! Tests of the IPC / file validation rules.

use super::apps::{AppSource, Art, Launch, MatchRule, NewApp};
use super::schema::Settings;
use super::validate::*;

fn exe(path: &str) -> Launch {
    Launch::Exe {
        path: path.into(),
        args: vec![],
        cwd: None,
        elevated: false,
    }
}
fn app(launch: Launch) -> NewApp {
    NewApp {
        name: "Test".into(),
        category: "jeux".into(),
        source: AppSource::Manual,
        launch,
        match_rule: MatchRule::default(),
        art: Art::default(),
        mood_id: None,
        favorite: false,
    }
}
fn field(l: Launch) -> Option<&'static str> {
    validate_new_app(&app(l)).err().map(|e| e.field)
}

#[test]
fn ids() {
    for ok in ["a", "minecraft", "half-life-2", &"a".repeat(40)] {
        assert!(validate_id(ok).is_ok(), "{ok}");
    }
    for bad in ["", "A", "a b", "a_b", "é", "../x", &"a".repeat(41)] {
        assert!(validate_id(bad).is_err(), "{bad}");
    }
}

#[test]
fn exe_paths() {
    assert_eq!(field(exe("C:\\Games\\a.exe")), None);
    assert_eq!(field(exe("c:\\games\\A.EXE")), None);
    assert_eq!(field(exe("a.exe")), Some("launch.path"));
    assert_eq!(field(exe("\\a.exe")), Some("launch.path"));
    assert_eq!(field(exe("C:\\Games\\..\\a.exe")), Some("launch.path"));
    assert_eq!(field(exe("C:\\Games\\a.bat")), Some("launch.path"));
    assert_eq!(field(exe("C:\\Games\\a\0.exe")), Some("launch.path"));
    assert_eq!(
        field(exe(&format!("C:\\{}.exe", "a".repeat(600)))),
        Some("launch.path")
    );
}

#[test]
fn exe_args_and_cwd() {
    let with = |args: Vec<String>, cwd: Option<&str>| Launch::Exe {
        path: "C:\\a.exe".into(),
        args,
        cwd: cwd.map(Into::into),
        elevated: false,
    };
    assert_eq!(
        field(with(vec!["-fullscreen".into()], Some("C:\\Games"))),
        None
    );
    assert_eq!(
        field(with(vec![String::new(); 33], None)),
        Some("launch.args")
    );
    assert_eq!(
        field(with(vec!["x".repeat(1025)], None)),
        Some("launch.args")
    );
    assert_eq!(field(with(vec![], Some("relative"))), Some("launch.cwd"));
}

#[test]
fn lnk_uri_uwp_url() {
    assert_eq!(
        field(Launch::Lnk {
            path: "C:\\a.lnk".into()
        }),
        None
    );
    assert_eq!(
        field(Launch::Lnk {
            path: "C:\\a.exe".into()
        }),
        Some("launch.path")
    );
    for ok in [
        "steam://rungameid/730",
        "com.epicgames.launcher://apps/x?action=launch",
    ] {
        assert_eq!(field(Launch::Uri { uri: ok.into() }), None, "{ok}");
    }
    for bad in [
        "file:///C:/a.exe",
        "javascript:alert(1)",
        "cmd://x",
        "steam://",
        "steam:rungame",
        "http://x",
    ] {
        assert_eq!(
            field(Launch::Uri { uri: bad.into() }),
            Some("launch.uri"),
            "{bad}"
        );
    }
    assert_eq!(
        field(Launch::Uwp {
            aumid: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App".into()
        }),
        None
    );
    assert_eq!(
        field(Launch::Uwp {
            aumid: "no-bang".into()
        }),
        Some("launch.aumid")
    );
    assert_eq!(
        field(Launch::Uwp {
            aumid: "a b!c".into()
        }),
        Some("launch.aumid")
    );
    assert_eq!(
        field(Launch::Url {
            url: "https://example.com/x".into()
        }),
        None
    );
    for bad in ["ftp://x", "https://", "file:///x", "example.com"] {
        assert_eq!(
            field(Launch::Url { url: bad.into() }),
            Some("launch.url"),
            "{bad}"
        );
    }
}

#[test]
fn names_and_match_and_art() {
    let mut a = app(exe("C:\\a.exe"));
    a.name = String::new();
    assert_eq!(validate_new_app(&a).unwrap_err().field, "name");
    a.name = "x".repeat(81);
    assert_eq!(validate_new_app(&a).unwrap_err().field, "name");
    a.name = "line\nbreak".into();
    assert_eq!(validate_new_app(&a).unwrap_err().field, "name");
    let mut a = app(exe("C:\\a.exe"));
    a.match_rule.exe = Some("C:\\x\\javaw.exe".into());
    assert_eq!(validate_new_app(&a).unwrap_err().field, "match.exe");
    a.match_rule.exe = Some("javaw.exe".into());
    assert!(validate_new_app(&a).is_ok());
    for bad in [
        "C:\\evil.png",
        "../x.jpg",
        "cache/art/../../x",
        "other/x.jpg",
        "/cache/art/x",
    ] {
        a.art.poster = Some(bad.into());
        assert_eq!(
            validate_new_app(&a).unwrap_err().field,
            "art.poster",
            "{bad}"
        );
    }
    a.art.poster = Some("cache/art/minecraft.poster.jpg".into());
    assert!(validate_new_app(&a).is_ok());
}

#[test]
fn settings() {
    let ok = Settings::default();
    assert!(validate_settings(&ok).is_ok());
    let bad = |f: &dyn Fn(&mut Settings)| {
        let mut s = Settings::default();
        f(&mut s);
        validate_settings(&s).unwrap_err().field
    };
    assert_eq!(bad(&|s| s.theme_id = "Not Valid".into()), "themeId");
    assert_eq!(bad(&|s| s.hotkey = "H".into()), "hotkey");
    assert_eq!(bad(&|s| s.hotkey = "Ctrl+".into()), "hotkey");
    assert_eq!(bad(&|s| s.hotkey = "Foo+H".into()), "hotkey");
    assert_eq!(bad(&|s| s.language = "xx".into()), "language");
    for v in [0.29, 1.01, f32::NAN, f32::INFINITY] {
        assert_eq!(bad(&|s| s.atmosphere_intensity = v), "atmosphereIntensity");
    }
    let low = Settings {
        atmosphere_intensity: 0.3,
        ..Settings::default()
    };
    assert!(validate_settings(&low).is_ok());
}
