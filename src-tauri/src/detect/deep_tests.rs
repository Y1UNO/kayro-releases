use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::*;
use crate::detect::deep_pick::{
    app_name, is_noise_exe, main_exe, opens_window, pick_logo, png_size,
};

fn f(path: &str, depth: usize, size: u64) -> (PathBuf, usize, u64) {
    (PathBuf::from(path), depth, size)
}

#[test]
fn installers_helpers_and_runtimes_are_never_the_app() {
    for stem in [
        "unins000",
        "UE4PrereqSetup_x64",
        "CrashReportClient",
        "steamwebhelper",
        "vc_redist.x64",
        "EasyAntiCheat_EOS",
    ] {
        assert!(is_noise_exe(stem), "{stem}");
    }
    for stem in ["Hades", "Celeste", "obs64", "Photoshop"] {
        assert!(!is_noise_exe(stem), "{stem}");
    }
    assert!(is_skipped_dir(Path::new(r"C:\Program Files\Common Files")));
    assert!(is_skipped_dir(Path::new(
        r"C:\Program Files\Windows Defender"
    )));
    assert!(is_skipped_dir(Path::new(r"C:\Program Files\Riot Vanguard")));
    assert!(is_skipped_dir(Path::new(
        r"C:\Program Files\obs-studio\obs-plugins"
    )));
    assert!(is_skipped_dir(Path::new(r"D:\Games\X\_CommonRedist")));
    assert!(!is_skipped_dir(Path::new(r"D:\Games\Hollow Knight")));
}

#[test]
fn the_app_s_own_program_is_picked_in_its_folder() {
    let files = [
        f(r"D:\Games\Hollow Knight\unins000.exe", 0, 3_000_000),
        f(
            r"D:\Games\Hollow Knight\UnityCrashHandler64.exe",
            0,
            1_500_000,
        ),
        f(r"D:\Games\Hollow Knight\hollow_knight.exe", 0, 650_000),
        f(r"D:\Games\Hollow Knight\readme.txt", 0, 2_000),
    ];
    let top = Path::new(r"D:\Games\Hollow Knight");
    let exe = main_exe(top, &files, &|_| true).unwrap();
    assert!(exe.ends_with("hollow_knight.exe"));
    // A console program is never proposed.
    assert_eq!(main_exe(top, &files, &|_| false), None);
    // Only helpers: nothing stands out, nothing is proposed.
    let helpers = [f(r"D:\Tools\X\setup.exe", 0, 5_000_000)];
    assert_eq!(
        main_exe(Path::new(r"D:\Tools\X"), &helpers, &|_| true),
        None
    );
}

#[test]
fn vendors_folders_give_the_app_s_name_not_the_vendor_s() {
    let cpuid = Path::new(r"C:\Program Files\CPUID");
    let cpuz = Path::new(r"C:\Program Files\CPUID\CPU-Z\cpuz.exe");
    assert_eq!(app_name(cpuid, cpuz), "CPU-Z");
    let amd = Path::new(r"C:\Program Files\AMD");
    let master = Path::new(r"C:\Program Files\AMD\RyzenMaster\bin\AMD Ryzen Master.exe");
    assert_eq!(app_name(amd, master), "AMD Ryzen Master");
    let bm = Path::new(r"C:\Program Files\Blackmagic Design");
    let files = [
        f(
            r"C:\Program Files\Blackmagic Design\DaVinci Resolve\Resolve.exe",
            1,
            90_000_000,
        ),
        f(
            r"C:\Program Files\Blackmagic Design\DaVinci Resolve\Blackmagic Remote Monitor.exe",
            1,
            9_000_000,
        ),
    ];
    let exe = main_exe(bm, &files, &|_| true).unwrap();
    assert!(exe.ends_with("Resolve.exe"));
    assert_eq!(app_name(bm, &exe), "DaVinci Resolve");
    // obs64 is OBS: digits do not hide the word; « bin » and « 64bit » are not its name.
    let obs = Path::new(r"C:\Program Files\obs-studio");
    let files = [f(
        r"C:\Program Files\obs-studio\bin\64bit\obs64.exe",
        2,
        6_000_000,
    )];
    let exe = main_exe(obs, &files, &|_| true).unwrap();
    assert_eq!(app_name(obs, &exe), "Obs-studio");
}

#[test]
fn console_tools_are_left_out() {
    let mut exe = vec![0u8; 0x200];
    exe[0x3C..0x40].copy_from_slice(&0x80u32.to_le_bytes());
    exe[0x80..0x84].copy_from_slice(b"PE\0\0");
    exe[0x80 + 0x5C..0x80 + 0x5E].copy_from_slice(&3u16.to_le_bytes());
    assert!(!opens_window(&exe));
    exe[0x80 + 0x5C..0x80 + 0x5E].copy_from_slice(&2u16.to_le_bytes());
    assert!(opens_window(&exe));
    assert!(opens_window(b"not a program"));
}

#[test]
fn a_logo_is_a_square_png_named_like_one_the_sharpest_up_to_512() {
    let files = [
        f(r"D:\Games\G\splash_logo.png", 1, 900_000),
        f(r"D:\Games\G\Content\StoreLogo.png", 2, 20_000),
        f(r"D:\Games\G\Content\Square150x150Logo.png", 2, 40_000),
        f(r"D:\Games\G\banner_logo.png", 1, 80_000),
        f(r"D:\Games\G\icon.ico", 1, 80_000),
    ];
    let sizes = |p: &Path| -> Option<(u32, u32)> {
        let n = p.file_name()?.to_string_lossy().into_owned();
        Some(match n.as_str() {
            "StoreLogo.png" => (50, 50),
            "Square150x150Logo.png" => (150, 150),
            "banner_logo.png" => (600, 200),
            _ => (2000, 2000),
        })
    };
    let logo = pick_logo(&files, &sizes).unwrap();
    assert!(logo.ends_with("Square150x150Logo.png"));
}

#[test]
fn png_sizes_come_from_the_header() {
    let mut head = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
    head.extend_from_slice(&256u32.to_be_bytes());
    head.extend_from_slice(&128u32.to_be_bytes());
    assert_eq!(png_size(&head), Some((256, 128)));
    assert_eq!(png_size(b"GIF89a"), None);
}

#[test]
fn roots_only_keep_folders_that_exist() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir(dir.path().join("Games")).unwrap();
    let found = roots(&[dir.path().to_path_buf()]);
    assert!(found
        .iter()
        .any(|(p, games)| p.ends_with("Games") && *games));
    assert!(!found.iter().any(|(p, _)| p.ends_with("Jeux")));
}

/// Manual probe, read only: `cargo test -p hub -- --ignored --nocapture deep_probe`.
#[cfg(windows)]
#[test]
#[ignore]
fn deep_probe() {
    let ctx = ScanCtx::default();
    let roots = roots(&fixed_disks());
    let t = std::time::Instant::now();
    let apps = scan_roots(&roots, &HashSet::new(), &ctx, &|_, _| {});
    println!("{} apps in {:?}", apps.len(), t.elapsed());
    for a in &apps {
        let exe = match &a.launch {
            Launch::Exe { path, .. } => path.as_str(),
            _ => "",
        };
        println!(
            "{:<30} {:<10} logo={} {exe}",
            a.name,
            a.suggested_category,
            a.logo_path.is_some()
        );
    }
}
