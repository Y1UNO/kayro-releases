use super::*;
use crate::detect::CancelToken;

const LIBRARYFOLDERS: &str = include_str!("../../tests/fixtures/steam/libraryfolders.vdf");
const MANIFEST_ONE: &str = include_str!("../../tests/fixtures/steam/appmanifest_1000001.acf");
const MANIFEST_TWO: &str = include_str!("../../tests/fixtures/steam/appmanifest_1000002.acf");
const MANIFEST_REDIST: &str = include_str!("../../tests/fixtures/steam/appmanifest_228980.acf");
const MANIFEST_DOWNLOADING: &str =
    include_str!("../../tests/fixtures/steam/appmanifest_1000003.acf");
const MANIFEST_TRUNCATED: &str = include_str!("../../tests/fixtures/steam/appmanifest_1000004.acf");

/// A fake Steam install: two libraries (the Steam folder and another disk) with the fixtures.
struct Fake {
    _dir: tempfile::TempDir,
    root: PathBuf,
    lib2: PathBuf,
}

fn vdf_escape(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "\\\\")
}

fn fake_steam() -> Fake {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("Steam");
    let lib2 = dir.path().join("SteamLibrary");
    for lib in [&root, &lib2] {
        fs::create_dir_all(lib.join("steamapps")).unwrap();
    }
    let vdf = LIBRARYFOLDERS
        .replace("@@LIB1@@", &vdf_escape(&root))
        .replace("@@LIB2@@", &vdf_escape(&lib2));
    fs::write(root.join("steamapps/libraryfolders.vdf"), vdf).unwrap();
    let put = |lib: &Path, id: &str, text: &str| {
        fs::write(lib.join(format!("steamapps/appmanifest_{id}.acf")), text).unwrap();
    };
    put(&root, "1000001", MANIFEST_ONE);
    put(&root, "228980", MANIFEST_REDIST);
    put(&root, "1000003", MANIFEST_DOWNLOADING);
    put(&root, "1000004", MANIFEST_TRUNCATED);
    put(&root, "1000005", ""); // empty file
    put(&lib2, "1000002", MANIFEST_TWO);
    Fake {
        _dir: dir,
        root,
        lib2,
    }
}

fn ctx() -> ScanCtx {
    ScanCtx::new(CancelToken::default())
}

#[test]
fn library_paths_come_from_libraryfolders() {
    let paths = parse_library_paths(
        &LIBRARYFOLDERS
            .replace("@@LIB1@@", "C:\\\\Games\\\\Steam")
            .replace("@@LIB2@@", "E:\\\\Lib"),
    )
    .unwrap();
    assert_eq!(
        paths,
        [PathBuf::from("C:\\Games\\Steam"), PathBuf::from("E:\\Lib")]
    );
}

#[test]
fn manifest_gives_id_and_name() {
    let m = parse_manifest(MANIFEST_ONE).unwrap();
    assert_eq!(
        m,
        Manifest {
            app_id: "1000001".into(),
            name: "Demo Game One".into()
        }
    );
}

#[test]
fn degraded_manifests_are_errors_not_panics() {
    assert!(parse_manifest("").is_err());
    assert!(parse_manifest(MANIFEST_TRUNCATED).is_err());
    assert!(parse_manifest("\"AppState\" { \"appid\" \"abc\" \"name\" \"x\" }").is_err());
    assert!(parse_manifest("\"AppState\" { \"appid\" \"1\" }").is_err());
    assert!(parse_manifest(MANIFEST_DOWNLOADING)
        .unwrap_err()
        .contains("not fully installed"));
    // Missing StateFlags is tolerated.
    assert!(parse_manifest("\"AppState\" { \"appid\" \"1\" \"name\" \"x\" }").is_ok());
    assert!(parse_library_paths("").is_err());
    assert!(parse_library_paths("\"libraryfolders\" { \"0\" { \"path\" ").is_err());
}

#[test]
fn scans_every_library_and_skips_tools_and_broken_files() {
    let f = fake_steam();
    let ctx = ctx();
    let apps = SteamSource::with_root(f.root.clone()).scan(&ctx).unwrap();
    let names: Vec<_> = apps.iter().map(|a| a.name.as_str()).collect();
    assert_eq!(names, ["Demo Game One", "Demo Game Two"]);
    assert_eq!(apps[0].id, "steam-1000001");
    assert_eq!(
        apps[0].launch,
        Launch::Uri {
            uri: "steam://rungameid/1000001".into()
        }
    );
    assert_eq!(
        apps[1].source,
        AppSource::Steam {
            app_id: "1000002".into()
        }
    );
    // redistributable, downloading, truncated, empty
    assert_eq!(ctx.skipped(), 4);
}

#[test]
fn missing_second_library_does_not_stop_the_scan() {
    let f = fake_steam();
    fs::remove_dir_all(&f.lib2).unwrap(); // disk unplugged
    let apps = SteamSource::with_root(f.root.clone()).scan(&ctx()).unwrap();
    assert_eq!(apps.len(), 1);
}

#[test]
fn damaged_libraryfolders_falls_back_to_the_steam_folder() {
    let f = fake_steam();
    fs::write(
        f.root.join("steamapps/libraryfolders.vdf"),
        "\"libraryfolders\" { \"0\"",
    )
    .unwrap();
    let apps = SteamSource::with_root(f.root.clone()).scan(&ctx()).unwrap();
    assert_eq!(apps.len(), 1);
}

#[test]
fn art_is_found_in_both_cache_layouts_with_priority() {
    let f = fake_steam();
    let cache = f.root.join("appcache/librarycache/1000001");
    // Layout A: files directly in the folder; layout B: one hash-named folder deeper.
    fs::create_dir_all(cache.join("aaaa")).unwrap();
    fs::create_dir_all(cache.join("bbbb")).unwrap();
    fs::write(cache.join("header.jpg"), b"x").unwrap();
    fs::write(cache.join("aaaa/library_capsule.jpg"), b"x").unwrap();
    fs::write(cache.join("bbbb/library_hero.jpg"), b"x").unwrap();
    let (poster, hero) = find_art(&f.root, "1000001");
    // capsule (nested) beats header (flat) in the priority list.
    assert!(poster
        .unwrap()
        .to_string_lossy()
        .ends_with("library_capsule.jpg"));
    assert!(hero
        .unwrap()
        .to_string_lossy()
        .ends_with("library_hero.jpg"));
    // A 600x900 poster wins over the capsule.
    fs::write(cache.join("library_600x900.jpg"), b"x").unwrap();
    let (poster, _) = find_art(&f.root, "1000001");
    assert!(poster
        .unwrap()
        .to_string_lossy()
        .ends_with("library_600x900.jpg"));
    // No cache folder at all: no art, no error.
    assert_eq!(find_art(&f.root, "42"), (None, None));
}

#[test]
fn scan_reports_art_paths() {
    let f = fake_steam();
    let cache = f.root.join("appcache/librarycache/1000001");
    fs::create_dir_all(&cache).unwrap();
    fs::write(cache.join("library_600x900.jpg"), b"x").unwrap();
    let apps = SteamSource::with_root(f.root.clone()).scan(&ctx()).unwrap();
    assert!(apps[0].poster_path.is_some() && apps[1].poster_path.is_none());
}

#[test]
fn cancelled_scan_returns_quickly_without_error() {
    let f = fake_steam();
    let token = CancelToken::default();
    token.cancel();
    let apps = SteamSource::with_root(f.root.clone())
        .scan(&ScanCtx::new(token))
        .unwrap();
    assert!(apps.is_empty());
}
