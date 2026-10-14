use std::fs;
use std::path::{Path, PathBuf};

use super::protocol::{answer, parse, Answer};
use super::*;
use crate::config::apps::{Art, Launch, MatchRule};

const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, b'J', b'F', b'I', b'F'];
const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0];

struct Fixture {
    _dir: tempfile::TempDir,
    roots: ArtRoots,
}

impl Fixture {
    fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let roots = ArtRoots {
            user: dir.path().join("art"),
            steam_cache: Some(dir.path().join("librarycache")),
        };
        fs::create_dir_all(roots.steam_cache.as_ref().unwrap()).unwrap();
        Self { _dir: dir, roots }
    }

    fn steam(&self, app_id: &str, file: &str, bytes: &[u8]) -> PathBuf {
        let path = self
            .roots
            .steam_cache
            .as_ref()
            .unwrap()
            .join(app_id)
            .join(file);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, bytes).unwrap();
        path
    }

    fn outside(&self, name: &str, bytes: &[u8]) -> PathBuf {
        let path = self._dir.path().join(name);
        fs::write(&path, bytes).unwrap();
        path
    }
}

fn app(id: &str, steam: Option<&str>) -> AppEntry {
    AppEntry {
        id: id.into(),
        name: id.into(),
        category: "jeux".into(),
        source: steam.map_or(AppSource::Manual, |s| AppSource::Steam { app_id: s.into() }),
        launch: Launch::Url {
            url: "https://example.org".into(),
        },
        match_rule: MatchRule::default(),
        art: Art::default(),
        mood_id: None,
        favorite: false,
        colors: None,
    }
}

fn name_of(found: Option<Found>) -> String {
    let path = found.expect("an image").path;
    path.file_name().unwrap().to_string_lossy().into_owned()
}

#[test]
fn every_steam_layout_is_read() {
    let f = Fixture::new();
    let cache = f.roots.steam_cache.clone().unwrap();
    // Flat (Bloons TD 6 on this PC).
    f.steam("1", "library_600x900.jpg", JPEG);
    f.steam("1", "library_hero.jpg", JPEG);
    // Hash-named folders only (Hades II).
    f.steam("2", "aaaa/library_capsule.jpg", JPEG);
    f.steam("2", "bbbb/logo.png", PNG);
    // Mixed: hero flat, poster nested (Clair Obscur).
    f.steam("3", "library_hero.jpg", JPEG);
    f.steam("3", "library_hero_blur.jpg", JPEG);
    f.steam("3", "cccc/library_600x900.jpg", JPEG);
    let p1 = locate::steam(&cache, "1", ArtRole::Poster).unwrap();
    assert!(!p1.low_res && p1.origin == ArtOrigin::Steam);
    let p2 = locate::steam(&cache, "2", ArtRole::Poster).unwrap();
    assert!(p2.low_res, "the capsule is the 300 × 450 one");
    assert_eq!(
        name_of(locate::steam(&cache, "2", ArtRole::Logo)),
        "logo.png"
    );
    assert_eq!(
        name_of(locate::steam(&cache, "3", ArtRole::Poster)),
        "library_600x900.jpg"
    );
    assert_eq!(
        name_of(locate::steam(&cache, "3", ArtRole::Hero)),
        "library_hero.jpg"
    );
    assert_eq!(
        name_of(locate::steam(&cache, "3", ArtRole::HeroBlur)),
        "library_hero_blur.jpg"
    );
}

#[test]
fn language_variants_are_found_and_french_wins() {
    let f = Fixture::new();
    let cache = f.roots.steam_cache.clone().unwrap();
    // Overwatch on this PC: only French files.
    f.steam("4", "dddd/library_capsule_french.jpg", JPEG);
    assert_eq!(
        name_of(locate::steam(&cache, "4", ArtRole::Poster)),
        "library_capsule_french.jpg"
    );
    f.steam("4", "dddd/library_capsule.jpg", JPEG);
    f.steam("4", "dddd/library_capsule_german.jpg", JPEG);
    assert_eq!(
        name_of(locate::steam(&cache, "4", ArtRole::Poster)),
        "library_capsule_french.jpg"
    );
    // A 600 × 900 in any language beats a capsule.
    f.steam("4", "eeee/library_600x900_german.jpg", JPEG);
    assert_eq!(
        name_of(locate::steam(&cache, "4", ArtRole::Poster)),
        "library_600x900_german.jpg"
    );
}

#[test]
fn headers_are_not_posters_and_the_icon_is_the_hash_named_file() {
    let f = Fixture::new();
    let cache = f.roots.steam_cache.clone().unwrap();
    f.steam("5", "header.jpg", JPEG);
    f.steam("5", "ffff/library_header.jpg", JPEG);
    assert!(locate::steam(&cache, "5", ArtRole::Poster).is_none());
    let icon = "0123456789abcdef0123456789abcdef01234567.jpg";
    f.steam("5", icon, JPEG);
    // The same name one level deeper is not the icon.
    f.steam("6", &format!("ffff/{icon}"), JPEG);
    assert_eq!(name_of(locate::steam(&cache, "5", ArtRole::Icon)), icon);
    assert!(locate::steam(&cache, "6", ArtRole::Icon).is_none());
}

#[test]
fn missing_or_odd_folders_give_nothing() {
    let f = Fixture::new();
    let cache = f.roots.steam_cache.clone().unwrap();
    assert!(locate::steam(&cache, "42", ArtRole::Poster).is_none());
    fs::create_dir_all(cache.join("43")).unwrap();
    assert!(locate::steam(&cache, "43", ArtRole::Poster).is_none());
    // Only digits are Steam ids: nothing outside the cache can be reached.
    for bad in ["..", "../art", "", "12a", "1234567890123"] {
        assert!(
            locate::steam(&cache, bad, ArtRole::Poster).is_none(),
            "{bad}"
        );
    }
}

#[test]
fn the_users_image_wins_and_can_be_removed() {
    let f = Fixture::new();
    f.steam("7", "library_600x900.jpg", JPEG);
    let game = app("steam-7", Some("7"));
    assert_eq!(
        find(&f.roots, &game, ArtRole::Poster).unwrap().origin,
        ArtOrigin::Steam
    );
    let mine = f.outside("mine.png", PNG);
    user::set(&f.roots.user, "steam-7", ArtRole::Poster, &mine).unwrap();
    let found = find(&f.roots, &game, ArtRole::Poster).unwrap();
    assert_eq!(found.origin, ArtOrigin::User);
    assert!(found.path.ends_with("steam-7/poster.png"));
    // A new image of another type replaces the old one (no poster.png left next to poster.jpg).
    let other = f.outside("other.jpg", JPEG);
    user::set(&f.roots.user, "steam-7", ArtRole::Poster, &other).unwrap();
    assert!(!f.roots.user.join("steam-7/poster.png").exists());
    user::clear(&f.roots.user, "steam-7", ArtRole::Poster).unwrap();
    assert_eq!(
        find(&f.roots, &game, ArtRole::Poster).unwrap().origin,
        ArtOrigin::Steam
    );
}

#[test]
fn only_real_small_images_are_accepted_from_the_user() {
    let f = Fixture::new();
    let fake = f.outside("fake.jpg", b"MZ not an image");
    let err = |src: &Path, role| user::set(&f.roots.user, "app", role, src).unwrap_err();
    assert_eq!(err(&fake, ArtRole::Poster), user::UserArtError::NotAnImage);
    let folder = f._dir.path().to_path_buf();
    assert_eq!(
        err(&folder, ArtRole::Poster),
        user::UserArtError::Unreadable
    );
    let png = f.outside("ok.png", PNG);
    assert_eq!(err(&png, ArtRole::Icon), user::UserArtError::NotSettable);
    let huge = f._dir.path().join("huge.jpg");
    fs::File::create(&huge)
        .unwrap()
        .set_len(MAX_BYTES + 1)
        .unwrap();
    assert_eq!(err(&huge, ArtRole::Poster), user::UserArtError::TooLarge);
    assert_eq!(
        user::set(&f.roots.user, "../x", ArtRole::Poster, &png),
        Err(user::UserArtError::BadId)
    );
    assert!(
        !f.roots.user.exists(),
        "nothing written for a refused image"
    );
}

#[test]
fn the_protocol_serves_only_known_apps_and_real_images() {
    let f = Fixture::new();
    f.steam("8", "library_600x900.jpg", JPEG);
    f.steam("9", "library_600x900.jpg", b"not a jpeg at all");
    let apps = [app("steam-8", Some("8")), app("steam-9", Some("9"))];
    match answer(&f.roots, &apps, "/steam-8/poster") {
        Answer::Image { mime, bytes } => assert!(mime == "image/jpeg" && bytes == JPEG),
        other => panic!("{other:?}"),
    }
    assert_eq!(answer(&f.roots, &apps, "/steam-9/poster"), Answer::NotFound);
    assert_eq!(answer(&f.roots, &apps, "/steam-1/poster"), Answer::NotFound);
    assert_eq!(answer(&f.roots, &apps, "/steam-8/hero"), Answer::NotFound);
    for bad in [
        "/steam-8/poster/x",
        "/steam-8/../../etc",
        "/../steam-8/poster",
        "/C:%5Cfile/poster",
        "/steam-8/library_600x900.jpg",
        "steam-8/poster",
        "/",
    ] {
        assert_eq!(answer(&f.roots, &apps, bad), Answer::BadRequest, "{bad}");
    }
    assert_eq!(
        parse("/steam-8/hero-blur"),
        Some(("steam-8", ArtRole::HeroBlur))
    );
}

#[test]
fn the_index_lists_images_with_a_stamp_that_follows_the_file() {
    let f = Fixture::new();
    let path = f.steam("10", "library_capsule.jpg", JPEG);
    f.steam("10", "logo.png", PNG);
    let apps = [app("steam-10", Some("10")), app("manual", None)];
    let index = index(&f.roots, &apps);
    assert_eq!(index.len(), 1, "apps without art are left out");
    let roles: Vec<ArtRole> = index[0].images.iter().map(|i| i.role).collect();
    assert_eq!(roles, [ArtRole::Poster, ArtRole::Logo]);
    assert!(index[0].images[0].low_res);
    let before = stamp(&path).unwrap();
    fs::write(&path, [JPEG, b"longer"].concat()).unwrap();
    assert_ne!(stamp(&path).unwrap(), before);
}

#[test]
fn image_kinds_are_told_by_their_bytes() {
    assert_eq!(sniff(JPEG), Some(("image/jpeg", "jpg")));
    assert_eq!(sniff(PNG), Some(("image/png", "png")));
    assert_eq!(sniff(b"RIFF\0\0\0\0WEBPVP8 "), Some(("image/webp", "webp")));
    assert_eq!(sniff(b"GIF89a"), None);
    assert_eq!(sniff(b""), None);
}
