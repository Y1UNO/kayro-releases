use super::*;
use crate::detect::CancelToken;

/// Writes a real `.lnk` through the Shell (COM must be initialised on this thread).
fn make_lnk(path: &Path, target: &str, args: &str) {
    // SAFETY: COM calls on interfaces created here; strings outlive each call.
    unsafe {
        let link: IShellLinkW =
            CoCreateInstance(&ShellLink, None::<&IUnknown>, CLSCTX_INPROC_SERVER).unwrap();
        link.SetPath(&HSTRING::from(target)).unwrap();
        link.SetArguments(&HSTRING::from(args)).unwrap();
        let file: IPersistFile = link.cast().unwrap();
        file.Save(&HSTRING::from(path.as_os_str()), true).unwrap();
    }
}

fn ctx() -> ScanCtx {
    ScanCtx::new(CancelToken::default())
}

fn source(roots: &[&Path]) -> StartMenuSource {
    StartMenuSource::with_roots(
        roots.iter().map(|r| r.to_path_buf()).collect(),
        Some(PathBuf::from("C:\\Windows")),
    )
}

#[test]
fn resolves_target_and_arguments() {
    let _com = Com::init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let lnk = dir.path().join("Foo.lnk");
    make_lnk(&lnk, "C:\\Games\\Foo\\foo.exe", "--fullscreen -x");
    let s = resolve(&lnk).unwrap();
    assert_eq!(s.target, PathBuf::from("C:\\Games\\Foo\\foo.exe"));
    assert_eq!(s.args, "--fullscreen -x");
}

#[test]
fn unreadable_shortcut_is_an_error_not_a_panic() {
    let _com = Com::init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let bad = dir.path().join("Bad.lnk");
    fs::write(&bad, b"not a shortcut").unwrap();
    assert!(resolve(&bad).is_err());
    assert!(resolve(&dir.path().join("missing.lnk")).is_err());
}

#[test]
fn scan_keeps_programs_and_drops_noise() {
    let _com = Com::init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let user = dir.path().join("user");
    let common = dir.path().join("common");
    fs::create_dir_all(user.join("Foo Studio")).unwrap();
    fs::create_dir_all(&common).unwrap();
    make_lnk(
        &user.join("Foo Studio/Foo.lnk"),
        "C:\\Games\\Foo\\foo.exe",
        "",
    );
    make_lnk(
        &user.join("Foo Studio/Uninstall Foo.lnk"),
        "C:\\Games\\Foo\\unins000.exe",
        "",
    );
    make_lnk(
        &user.join("Foo Studio/Foo Manual.lnk"),
        "C:\\Games\\Foo\\manual.html",
        "",
    );
    make_lnk(
        &common.join("Foo (again).lnk"),
        "c:\\games\\foo\\FOO.exe",
        "",
    ); // same target
    make_lnk(
        &common.join("Registry Editor.lnk"),
        "C:\\Windows\\regedit.exe",
        "",
    );
    make_lnk(&common.join("Bar.lnk"), "D:\\Apps\\bar.exe", "--safe");
    fs::write(common.join("Broken.lnk"), b"garbage").unwrap();
    fs::write(common.join("readme.txt"), b"ignored").unwrap();

    let ctx = ctx();
    let apps = source(&[&user, &common]).scan(&ctx).unwrap();
    let names: Vec<_> = apps.iter().map(|a| a.name.as_str()).collect();
    assert_eq!(names, ["Bar", "Foo"]);
    let foo = apps.iter().find(|a| a.name == "Foo").unwrap();
    assert_eq!(foo.match_rule.exe.as_deref(), Some("foo.exe"));
    assert!(foo.id.starts_with("menu-"));
    assert!(matches!(&foo.launch, Launch::Lnk { path } if path.ends_with("Foo.lnk")));
    // uninstaller, manual, duplicate, system tool, broken shortcut
    assert_eq!(ctx.skipped(), 5);
}

#[test]
fn ids_are_stable_between_scans() {
    let _com = Com::init().unwrap();
    let dir = tempfile::tempdir().unwrap();
    make_lnk(&dir.path().join("Foo.lnk"), "C:\\Games\\Foo\\foo.exe", "");
    let src = source(&[dir.path()]);
    let first = src.scan(&ctx()).unwrap();
    let second = src.scan(&ctx()).unwrap();
    assert_eq!(first[0].id, second[0].id);
}

#[test]
fn missing_root_is_fine() {
    let dir = tempfile::tempdir().unwrap();
    let apps = source(&[&dir.path().join("nope")]).scan(&ctx()).unwrap();
    assert!(apps.is_empty());
}

#[test]
fn cancelled_scan_stops() {
    let dir = tempfile::tempdir().unwrap();
    let _com = Com::init().unwrap();
    make_lnk(&dir.path().join("Foo.lnk"), "C:\\Games\\Foo\\foo.exe", "");
    let token = CancelToken::default();
    token.cancel();
    let apps = source(&[dir.path()]).scan(&ScanCtx::new(token)).unwrap();
    assert!(apps.is_empty());
}
