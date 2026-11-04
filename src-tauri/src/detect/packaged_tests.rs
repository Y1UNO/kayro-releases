use super::*;

#[test]
fn only_package_aumids_are_split() {
    assert_eq!(
        split_aumid("Claude_pzs8sxrjxfjjc!Claude"),
        Some(("Claude", "pzs8sxrjxfjjc", "Claude"))
    );
    assert_eq!(
        split_aumid("MicrosoftWindows.Client.CBS_cw5n1h2txyewy!WindowsBackup"),
        Some((
            "MicrosoftWindows.Client.CBS",
            "cw5n1h2txyewy",
            "WindowsBackup"
        ))
    );
    assert_eq!(split_aumid("com.squirrel.Discord.Discord"), None);
    assert_eq!(split_aumid("steam://rungameid/960090"), None);
    assert_eq!(split_aumid("Foo_short!App"), None);
    assert_eq!(split_aumid("Foo_PZS8SXRJXFJJC!App"), None);
    assert_eq!(split_aumid("Foo_pzs8sxrjxfjjc!"), None);
}

#[test]
fn windows_own_apps_are_told_apart() {
    let w = |aumid: &str| {
        let (p, publ, _) = split_aumid(aumid).unwrap();
        is_windows_app(p, publ)
    };
    assert!(w(
        "windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel"
    ));
    assert!(w("Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"));
    assert!(w("Microsoft.Windows.Photos_8wekyb3d8bbwe!App"));
    assert!(w("MicrosoftCorporationII.QuickAssist_8wekyb3d8bbwe!App"));
    assert!(w("Microsoft.XboxGamingOverlay_8wekyb3d8bbwe!App"));
    assert!(!w("Microsoft.WindowsTerminal_8wekyb3d8bbwe!App"));
    assert!(!w("Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App"));
    assert!(!w("MSTeams_8wekyb3d8bbwe!MSTeams"));
    assert!(!w("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify"));
    assert!(!w("Claude_pzs8sxrjxfjjc!Claude"));
}

const MANIFEST: &str = r#"<Package><Applications>
  <Application Id="Claude" Executable="app\Claude.exe" EntryPoint="Windows.FullTrustApplication">
    <uap:VisualElements DisplayName="Claude"/>
  </Application>
  <Application uap10:HostId="X" Id='SshAskpass' Executable='app\resources\claude-ssh-askpass.exe'>
  </Application>
  <Application Id="Spotify" Executable="SpotifyMigrator.exe"/>
  <Application Id="Minecraft" Executable="GameLaunchHelper.exe"/>
  <Application Id="Dev" Executable="$targetnametoken$.exe"/>
  <Application Id="Web" StartPage="index.html"/>
</Applications></Package>"#;

#[test]
fn the_manifest_names_the_program_to_watch() {
    assert_eq!(
        manifest_exe(MANIFEST, "Claude").as_deref(),
        Some("Claude.exe")
    );
    assert_eq!(
        manifest_exe(MANIFEST, "claude").as_deref(),
        Some("Claude.exe")
    );
    assert_eq!(
        manifest_exe(MANIFEST, "SshAskpass").as_deref(),
        Some("claude-ssh-askpass.exe")
    );
    assert_eq!(
        manifest_exe(MANIFEST, "Spotify"),
        None,
        "a starter, not the app"
    );
    assert_eq!(
        manifest_exe(MANIFEST, "Minecraft"),
        None,
        "a starter, not the app"
    );
    assert_eq!(manifest_exe(MANIFEST, "Dev"), None);
    assert_eq!(manifest_exe(MANIFEST, "Web"), None);
    assert_eq!(manifest_exe(MANIFEST, "X"), None, "HostId is not Id");
    assert_eq!(manifest_exe(MANIFEST, "Missing"), None);
    assert_eq!(
        manifest_exe("<Application Id=\"A\" Executable=\"a.exe\"", "A"),
        None
    );
}

#[test]
fn proposals_skip_windows_apps_and_known_shortcuts() {
    let ctx = ScanCtx::default();
    let item = |aumid: &str, name: &str| Packaged {
        aumid: aumid.into(),
        name: name.into(),
    };
    let shortcut = DetectedApp {
        id: "menu-1".into(),
        name: "Discord".into(),
        source: AppSource::Startmenu,
        launch: Launch::Lnk {
            path: "C:\\x\\Discord.lnk".into(),
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
    };
    let apps = to_apps(
        vec![
            item("Fake.NotInstalled_pzs8sxrjxfjjc!App", "Mon app"),
            item(
                "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
                "Calculatrice",
            ),
            item("Fake.Discord_pzs8sxrjxfjjc!App", "discord"),
            item("Fake.Twice_pzs8sxrjxfjjc!App", "Mon app"),
        ],
        &[shortcut],
        &ctx,
    );
    assert_eq!(apps.len(), 1);
    let app = &apps[0];
    assert_eq!(app.name, "Mon app");
    assert_eq!(
        app.launch,
        Launch::Uwp {
            aumid: "Fake.NotInstalled_pzs8sxrjxfjjc!App".into()
        }
    );
    assert!(app.id.starts_with("menu-") && app.match_rule.exe.is_none());
    assert_eq!(ctx.skipped(), 3);
}

/// On this PC (the Calculator ships with Windows 10 and 11).
#[test]
fn the_apps_folder_lists_packages_with_their_folder() {
    let _com = super::super::startmenu::Com::init().unwrap();
    let all = list(&ScanCtx::default()).unwrap();
    let calc = all
        .iter()
        .find(|p| {
            p.aumid
                .eq_ignore_ascii_case("Microsoft.WindowsCalculator_8wekyb3d8bbwe!App")
        })
        .expect("the Calculator is listed");
    assert!(!calc.name.is_empty());
    let family = "Microsoft.WindowsCalculator_8wekyb3d8bbwe";
    assert!(package_dirs(family)
        .iter()
        .any(|d| d.join("AppxManifest.xml").is_file()));
    assert!(program_of(family, "App").is_some_and(|e| e.to_lowercase().ends_with(".exe")));
}
