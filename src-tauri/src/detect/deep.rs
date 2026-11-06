//! Step 19c, the advanced scan (« Scan avancé », started by the user, who is told what it does):
//! Kayro looks through the program and game folders of the PC's own disks for apps the Start Menu
//! does not list (a game in `D:\Games`, a portable tool…) and, in every app's folder, for a sharper
//! logo than the program's icon (a PNG of the app's own). Read-only, nothing leaves the PC; bounded
//! in depth and in folders visited; cancellable between folders.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::category::suggest_category;
use super::deep_pick::{app_name, main_exe, opens_window, pick_logo, png_size};
use super::{is_kayro, short_hash, DetectedApp, ScanCtx};
use crate::config::apps::{AppSource, Launch, MatchRule};

/// Folders of a disk that hold apps; `true`: everything in it is a game.
const ROOTS: [(&str, bool); 11] = [
    ("Program Files\\Epic Games", true),
    ("Program Files (x86)\\Epic Games", true),
    ("Program Files", false),
    ("Program Files (x86)", false),
    ("Games", true),
    ("Jeux", true),
    ("Riot Games", true),
    ("Epic Games", true),
    ("GOG Games", true),
    ("Ubisoft", true),
    ("Program Files\\Ubisoft\\Ubisoft Game Launcher\\games", true),
];

/// Folders never looked into (Windows' own, runtimes, installers' leftovers), lower case.
const SKIP_DIRS: &[&str] = &[
    "common files",
    "windowsapps",
    "windows defender",
    "windows mail",
    "windows media player",
    "windows nt",
    "windows photo viewer",
    "windows portable devices",
    "windows security",
    "windows sidebar",
    "windowspowershell",
    "internet explorer",
    "microsoft.net",
    "dotnet",
    "reference assemblies",
    "msbuild",
    "microsoft update health tools",
    "uninstall information",
    "modifiablewindowsapps",
    "packagemanagement",
    "windows kits",
    "microsoft sdks",
    "iis",
    "package cache",
    "_commonredist",
    "commonredist",
    "redist",
    "redistributables",
    "directx",
    "vcredist",
    "__installer",
    "installer",
    "installers",
    "support",
    ".git",
    "node_modules",
    "crashreport",
    "crashreporter",
    "logs",
    "cache",
    "temp",
    "locales",
    "resources",
    "shared",
    // Its own root (its games, one by one), not one app of « Program Files ».
    "epic games",
    // A Steam library: the Steam source already lists its games.
    "steamapps",
    "steamlibrary",
];

/// At the top of a disk (2026-11-04), the folders that hold no app of their own, lower case. The
/// folders of `ROOTS` are read on their own.
const DISK_SKIP: &[&str] = &[
    "windows",
    "windows.old",
    "program files",
    "program files (x86)",
    "programdata",
    "users",
    "documents and settings",
    "perflogs",
    "recovery",
    "system volume information",
    "boot",
    "efi",
    "msocache",
    "config.msi",
    "intel",
    "amd",
    "nvidia",
    "drivers",
    "inetpub",
    "onedrivetemp",
    "xboxgames",
    "esd",
    "swsetup",
    "temp",
    "tmp",
];

/// How deep inside an app's folder a program or a logo is looked for, and how many folders a scan
/// visits at most (a big disk stays bounded).
const APP_DEPTH: usize = 3;
pub const MAX_FOLDERS: u32 = 20_000;

/// The disks of this PC that hold files (no CD, no network drive).
#[cfg(windows)]
pub fn fixed_disks() -> Vec<PathBuf> {
    use windows::core::HSTRING;
    use windows::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
    const DRIVE_FIXED: u32 = 3;
    // SAFETY: plain queries of the system, no buffer.
    let mask = unsafe { GetLogicalDrives() };
    (0..26u8)
        .filter(|i| mask & (1 << i) != 0)
        .map(|i| format!("{}:\\", char::from(b'A' + i)))
        .filter(|d| unsafe { GetDriveTypeW(&HSTRING::from(d.as_str())) } == DRIVE_FIXED)
        .map(PathBuf::from)
        .collect()
}

/// Where apps are looked for on `disks`: (folder, everything in it is a game).
pub fn roots(disks: &[PathBuf]) -> Vec<(PathBuf, bool)> {
    let mut out: Vec<(PathBuf, bool)> = disks
        .iter()
        .flat_map(|d| ROOTS.iter().map(move |(r, games)| (d.join(r), *games)))
        .collect();
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        out.push((PathBuf::from(local).join("Programs"), false));
    }
    // 2026-11-04: the top of each disk too (`C:\Jeux PixelArt`), past what holds no app.
    out.extend(disks.iter().map(|d| (d.clone(), false)));
    out.retain(|(p, _)| p.is_dir());
    out
}

/// A folder at the top of a disk that holds no app of its own (Windows, users, drivers…), one
/// of `ROOTS` (read on its own), a Steam library, or a code repository (its builds are no apps,
/// and its `target` or `node_modules` would cost seconds).
pub fn is_disk_noise(folder: &Path) -> bool {
    let n = lower_name(folder);
    DISK_SKIP.contains(&n.as_str())
        || ROOTS.iter().any(|(r, _)| r.eq_ignore_ascii_case(&n))
        || folder.join("steamapps").is_dir()
        || folder.join(".git").exists()
}

/// `a` is the folder `b` or one inside it (lower case; `git` is not `github cli`).
pub fn within(a: &str, b: &str) -> bool {
    let b = b.trim_end_matches('\\');
    a.strip_prefix(b)
        .is_some_and(|rest| rest.is_empty() || rest.starts_with('\\'))
}

fn lower_name(p: &Path) -> String {
    p.file_name()
        .map(|f| f.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

pub fn is_skipped_dir(p: &Path) -> bool {
    let n = lower_name(p);
    n.starts_with("windows ")
        || n.starts_with('$')
        || SKIP_DIRS.contains(&n.as_str())
        || [
            "plugin",
            "anticheat",
            "vanguard",
            "vulkanrt",
            "runtime",
            "redist",
        ]
        .iter()
        .any(|w| n.contains(w))
}

/// Files and folders under `dir`, `depth` levels at most; `visit` counts the folders read.
fn walk(
    dir: &Path,
    depth: usize,
    ctx: &ScanCtx,
    visit: &mut dyn FnMut() -> bool,
    out: &mut Vec<(PathBuf, usize, u64)>,
) {
    if ctx.cancelled() || !visit() {
        return;
    }
    let Ok(read) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in read.flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        if kind.is_dir() {
            if depth > 0 && !is_skipped_dir(&path) {
                walk(&path, depth - 1, ctx, visit, out);
            }
        } else if kind.is_file() {
            let size = entry.metadata().map_or(0, |m| m.len());
            out.push((path, APP_DEPTH - depth, size));
        }
    }
}

/// The first kilobyte of a program: enough for its PE header (console or window).
pub fn is_window(p: &Path) -> bool {
    use std::io::Read;
    let mut head = vec![0u8; 1024];
    let read = std::fs::File::open(p).and_then(|mut f| f.read(&mut head));
    read.map_or(true, |n| opens_window(&head[..n]))
}

fn read_png_size(p: &Path) -> Option<(u32, u32)> {
    use std::io::Read;
    let mut head = [0u8; 24];
    std::fs::File::open(p).ok()?.read_exact(&mut head).ok()?;
    png_size(&head)
}

/// The logo of `app` in its folder (`dir`), if it has one; a folder too near a disk's root is
/// skipped.
pub fn find_logo(dir: &Path, app: &str, ctx: &ScanCtx) -> Option<PathBuf> {
    if dir.components().count() < 3 || is_skipped_dir(dir) {
        return None;
    }
    let mut files = Vec::new();
    let mut budget = 200u32;
    walk(
        dir,
        2,
        ctx,
        &mut || {
            budget = budget.saturating_sub(1);
            budget > 0
        },
        &mut files,
    );
    pick_logo(&files, app, &read_png_size)
}

/// Apps found in `roots` that no other source listed (`known`: folders already proposed, lower
/// case). `on_progress(folders, found)` is called now and then.
pub fn scan_roots(
    roots: &[(PathBuf, bool)],
    known: &HashSet<String>,
    ctx: &ScanCtx,
    on_progress: &dyn Fn(u32, u32),
) -> Vec<DetectedApp> {
    let mut apps = Vec::new();
    let mut folders = 0u32;
    let mut reported = 0u32;
    for (root, games) in roots {
        let Ok(read) = std::fs::read_dir(root) else {
            continue;
        };
        let disk_top = root.parent().is_none();
        for entry in read.flatten() {
            let folder = entry.path();
            if ctx.cancelled() || folders >= MAX_FOLDERS {
                return apps;
            }
            if !folder.is_dir() || is_skipped_dir(&folder) || (disk_top && is_disk_noise(&folder)) {
                continue;
            }
            let key = folder.to_string_lossy().to_lowercase();
            if known.iter().any(|k| within(k, &key) || within(&key, k)) {
                continue;
            }
            let mut files = Vec::new();
            walk(
                &folder,
                APP_DEPTH,
                ctx,
                &mut || {
                    folders += 1;
                    folders < MAX_FOLDERS
                },
                &mut files,
            );
            if folders - reported >= 40 {
                reported = folders;
                on_progress(folders, apps.len() as u32);
            }
            let Some(exe) = main_exe(&folder, &files, &is_window).filter(|e| !is_kayro(e)) else {
                continue;
            };
            let name = app_name(&folder, &exe);
            let exe_name = exe.file_name().map(|f| f.to_string_lossy().into_owned());
            let category = if *games {
                "jeux"
            } else {
                suggest_category(&name, exe_name.as_deref(), None)
            };
            let path = exe.to_string_lossy().into_owned();
            let logo = pick_logo(&files, &name, &read_png_size);
            let app = DetectedApp {
                id: format!("deep-{}", short_hash(&path.to_lowercase())),
                name,
                source: AppSource::Manual,
                launch: Launch::Exe {
                    path,
                    args: Vec::new(),
                    cwd: exe.parent().map(|d| d.to_string_lossy().into_owned()),
                    elevated: false,
                },
                match_rule: MatchRule { exe: exe_name },
                poster_path: None,
                hero_path: None,
                already_added: false,
                suggested_category: category.into(),
                launcher: false,
                ignored: false,
                install_dir: Some(folder.to_string_lossy().into_owned()),
                logo_path: logo.map(|p| p.to_string_lossy().into_owned()),
            };
            apps.extend(ctx.accept(super::SourceKind::Deep, app));
        }
    }
    on_progress(folders, apps.len() as u32);
    apps
}

#[cfg(test)]
#[path = "deep_tests.rs"]
mod tests;
