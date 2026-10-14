use std::cell::Cell;
use std::fs;
use std::io::Cursor;

use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};

use super::*;
use crate::config::apps::{AppSource, Art, Launch, MatchRule};

fn png(colour: [u8; 4]) -> Vec<u8> {
    let img = RgbaImage::from_pixel(12, 18, Rgba(colour));
    let mut out = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(img)
        .write_to(&mut out, ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

fn app(id: &str, steam: Option<&str>, launch: Launch) -> AppEntry {
    AppEntry {
        id: id.into(),
        name: id.into(),
        category: "jeux".into(),
        source: steam.map_or(AppSource::Manual, |s| AppSource::Steam { app_id: s.into() }),
        launch,
        match_rule: MatchRule::default(),
        art: Art::default(),
        mood_id: None,
        favorite: false,
    }
}

fn url() -> Launch {
    Launch::Url {
        url: "https://example.org".into(),
    }
}

struct Fixture {
    dir: tempfile::TempDir,
    roots: ArtRoots,
}

impl Fixture {
    fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let roots = ArtRoots {
            user: dir.path().join("art"),
            steam_cache: Some(dir.path().join("librarycache")),
        };
        Self { dir, roots }
    }

    fn steam_file(&self, app_id: &str, name: &str, bytes: &[u8]) {
        let dir = self.roots.steam_cache.as_ref().unwrap().join(app_id);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(name), bytes).unwrap();
    }

    fn cache(&self) -> std::path::PathBuf {
        self.dir.path().join("cache/palettes.json")
    }
}

const NO_ICON: &dyn Fn(&AppEntry) -> Option<Vec<u8>> = &|_| None;

#[test]
fn palettes_are_computed_once_then_read_back() {
    let f = Fixture::new();
    f.steam_file("1", "library_600x900.jpg", &png([200, 40, 40, 255]));
    f.steam_file("1", "library_hero.jpg", &png([40, 70, 210, 255]));
    let apps = [app("steam-1", Some("1"), url())];
    let first = refresh(&f.roots, &apps, &f.cache(), NO_ICON);
    assert_eq!((first.computed, first.failed, first.changed), (2, 0, true));
    let sources: Vec<PaletteSource> = first.palettes.iter().map(|p| p.source).collect();
    assert_eq!(sources, [PaletteSource::Poster, PaletteSource::Hero]);
    assert_eq!(first.palettes[0].palette.colors[0].hex, "#c82828");
    let again = refresh(&f.roots, &apps, &f.cache(), NO_ICON);
    assert_eq!((again.computed, again.changed), (0, false));
    assert_eq!(again.palettes, first.palettes);
}

#[test]
fn a_changed_image_is_computed_again_and_removed_apps_leave_the_cache() {
    let f = Fixture::new();
    f.steam_file("2", "library_capsule.jpg", &png([200, 40, 40, 255]));
    let apps = [app("steam-2", Some("2"), url())];
    refresh(&f.roots, &apps, &f.cache(), NO_ICON);
    // Another image (another size): a new fingerprint.
    let bigger = {
        let img = RgbaImage::from_pixel(30, 45, Rgba([20, 160, 90, 255]));
        let mut out = Cursor::new(Vec::new());
        DynamicImage::ImageRgba8(img)
            .write_to(&mut out, ImageFormat::Png)
            .unwrap();
        out.into_inner()
    };
    f.steam_file("2", "library_capsule.jpg", &bigger);
    let r = refresh(&f.roots, &apps, &f.cache(), NO_ICON);
    assert_eq!(r.computed, 1);
    assert_eq!(r.palettes[0].palette.colors[0].hex, "#14a05a");
    let gone = refresh(&f.roots, &[], &f.cache(), NO_ICON);
    assert!(gone.changed && gone.palettes.is_empty());
    assert!(!fs::read_to_string(f.cache()).unwrap().contains("steam-2"));
}

#[test]
fn a_broken_image_is_not_tried_again_until_it_changes() {
    let f = Fixture::new();
    f.steam_file("3", "library_600x900.jpg", &[0xFF, 0xD8, 0xFF, 0, 1, 2]);
    let apps = [app("steam-3", Some("3"), url())];
    let r = refresh(&f.roots, &apps, &f.cache(), NO_ICON);
    assert_eq!((r.computed, r.failed), (1, 1));
    assert!(r.palettes.is_empty());
    assert_eq!(refresh(&f.roots, &apps, &f.cache(), NO_ICON).computed, 0);
}

#[test]
fn apps_without_poster_or_hero_take_their_icon() {
    let f = Fixture::new();
    let exe = Launch::Exe {
        path: r"C:\Tools\tool.exe".into(),
        args: vec![],
        cwd: None,
        elevated: false,
    };
    let apps = [app("tool", None, exe), app("site", None, url())];
    let asked = Cell::new(0);
    let icon = |a: &AppEntry| {
        asked.set(asked.get() + 1);
        assert_eq!(a.id, "tool");
        Some(png([240, 180, 30, 255]))
    };
    let r = refresh(&f.roots, &apps, &f.cache(), &icon);
    assert_eq!(r.palettes.len(), 1);
    assert_eq!(r.palettes[0].source, PaletteSource::Icon);
    refresh(&f.roots, &apps, &f.cache(), &icon);
    assert_eq!(asked.get(), 1, "the icon's palette is cached too");
}

#[test]
fn an_unreadable_cache_is_rebuilt() {
    let f = Fixture::new();
    f.steam_file("4", "library_600x900.jpg", &png([200, 40, 40, 255]));
    fs::create_dir_all(f.cache().parent().unwrap()).unwrap();
    fs::write(f.cache(), b"{ broken").unwrap();
    let apps = [app("steam-4", Some("4"), url())];
    let r = refresh(&f.roots, &apps, &f.cache(), NO_ICON);
    assert_eq!((r.computed, r.palettes.len()), (1, 1));
    let saved: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(f.cache()).unwrap()).unwrap();
    assert_eq!(saved["schemaVersion"], 1);
}
