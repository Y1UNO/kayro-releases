//! Step 19c, the advanced scan's choices inside one app folder: which program is the app (not an
//! installer, a helper, a command-line tool), what to call it (not the vendor's name), and which
//! PNG is its logo. Pure functions on paths, sizes and file headers (tested without the disk).

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::category::normalise;
use super::relevance::clean_name;

/// Files of an app folder: path, depth below the folder, size in bytes.
pub type Files = [(PathBuf, usize, u64)];

/// Programs that are never the app itself (file stem, lower case, contains).
const NOISE_EXE: &[&str] = &[
    "unins",
    "setup",
    "install",
    "update",
    "crash",
    "report",
    "helper",
    "redist",
    "dxsetup",
    "prereq",
    "service",
    "server",
    "diag",
    "cleanup",
    "repair",
    "benchmark",
    "elevate",
    "notification",
    "register",
    "activation",
    "license",
    "bugsplat",
    "sentry",
    "cefprocess",
    "renderer",
    "gpu",
    "dotnet",
    "python",
    "java",
    "node",
    "7z",
    "anticheat",
    "browser-page",
    "protocolselector",
    "remote monitor",
    "controlpanel",
    "vulkaninfo",
    "welcome",
    "nefcon",
];

/// Folders under a program that hold the program itself, not its name (« bin », « x64 »…).
const PLAIN_DIRS: &[&str] = &[
    "bin", "bin64", "x64", "x86", "win64", "win32", "64bit", "live", "app", "exe", "build",
    "builds", "release",
];

/// Words of a logo's file name that say nothing of which app it is (« app_icon_256 »).
const LOGO_WORDS: &[&str] = &["logo", "icon", "app", "scale", "x"];

/// Words of a PNG name that make it something else than the app's logo: a tile variant made for a
/// coloured plate, a tray or notification picture, a banner, a splash screen.
const NOT_A_LOGO: &[&str] = &[
    "splash",
    "background",
    "banner",
    "wide",
    "altform",
    "targetsize",
    "contrast",
    "unplated",
    "small",
    "tray",
    "badge",
    "notification",
    "store",
];

/// Lower-case words of a name, also cut where the case or the kind of character changes
/// (« VoicemeeterLogo » → voicemeeter, logo; « icon256 » → icon, 256).
fn split_words(text: &str) -> Vec<String> {
    let mut spaced = String::with_capacity(text.len() + 8);
    let mut prev: Option<char> = None;
    for c in text.chars() {
        if let Some(p) = prev {
            let case_up = p.is_lowercase() && c.is_uppercase();
            let kind = p.is_ascii_digit() != c.is_ascii_digit() && p.is_alphanumeric();
            if case_up || (kind && c.is_alphanumeric()) {
                spaced.push(' ');
            }
        }
        spaced.push(c);
        prev = Some(c);
    }
    normalise(&spaced).split(' ').map(str::to_string).collect()
}

/// A PNG named as `app`'s logo: a logo or icon word, plain words (sizes, « app ») and, if any, the
/// app's whole name (« VoicemeeterLogo » is not « Voicemeeter Banana »'s); never a tile variant,
/// a tray picture, a banner.
pub fn named_as_logo(file_stem: &str, app: &str) -> bool {
    let words = split_words(file_stem);
    let app_words = split_words(app);
    let plain =
        |w: &String| LOGO_WORDS.contains(&w.as_str()) || w.bytes().all(|b| b.is_ascii_digit());
    let named = words.iter().any(|w| app_words.contains(w));
    words.iter().any(|w| w == "logo" || w == "icon")
        && !words.iter().any(|w| NOT_A_LOGO.contains(&w.as_str()))
        && words.iter().all(|w| plain(w) || app_words.contains(w))
        && (!named || app_words.iter().all(|a| words.contains(a)))
}

pub fn is_noise_exe(stem: &str) -> bool {
    let s = stem.to_lowercase();
    NOISE_EXE.iter().any(|n| s.contains(n))
}

/// Words of a name without digits (« obs64 » → « obs »), for matching a program to its folder.
fn words(text: &str) -> HashSet<String> {
    normalise(text)
        .split(' ')
        .map(|w| w.trim_matches(|c: char| c.is_ascii_digit()).to_string())
        .filter(|w| w.len() > 1)
        .collect()
}

/// The folder right above the program, skipping the plain ones (« bin », « x64 »…).
fn named_parent(exe: &Path, top: &Path) -> Option<String> {
    let mut dir = exe.parent()?;
    while dir != top {
        let n = dir.file_name()?.to_string_lossy().to_lowercase();
        // A version folder (« 9262 », « 1.0.65 ») is no name either.
        let named = n.chars().any(char::is_alphabetic);
        if named && !PLAIN_DIRS.contains(&n.as_str()) {
            return Some(dir.file_name()?.to_string_lossy().into_owned());
        }
        dir = dir.parent()?;
    }
    None
}

/// How well a program matches its folders (the top one or its own), how shallow and how big it is.
fn score(top: &Path, exe: &Path, depth: usize, size: u64) -> i64 {
    let stem = exe
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let mine = words(&stem);
    let shared = |folder: &str| words(folder).intersection(&mine).count() as i64;
    let top_name = top
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_default();
    let parent = named_parent(exe, top).unwrap_or_default();
    let joined = normalise(&top_name).replace(' ', "") == normalise(&stem).replace(' ', "");
    (if joined { 50 } else { 0 }) + shared(&top_name).max(shared(&parent)) * 20 - depth as i64 * 6
        + (size / 2_000_000).min(20) as i64
}

/// The app's own program in `top` (not an installer, a helper or a console tool), if one stands
/// out. `is_window`: the program opens a window (its file says so), not a console.
pub fn main_exe(top: &Path, files: &Files, is_window: &dyn Fn(&Path) -> bool) -> Option<PathBuf> {
    files
        .iter()
        .filter(|(p, _, size)| {
            p.extension().is_some_and(|e| e.eq_ignore_ascii_case("exe"))
                && *size > 200_000
                && !is_noise_exe(&p.file_stem().unwrap_or_default().to_string_lossy())
        })
        .map(|(p, depth, size)| (score(top, p, *depth, *size), p))
        .filter(|(s, _)| *s > -10)
        .filter(|(_, p)| is_window(p))
        .max_by_key(|(s, _)| *s)
        .map(|(_, p)| p.clone())
}

/// What to call the app: the program's own name when it reads like one (« AMD Ryzen Master »),
/// else the folder it lives in (« CPU-Z », not the vendor « CPUID »), else the top folder.
pub fn app_name(top: &Path, exe: &Path) -> String {
    let stem = exe
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    if stem.contains(' ') && stem.chars().any(char::is_uppercase) {
        return clean_name(&stem);
    }
    let folder = named_parent(exe, top)
        .or_else(|| top.file_name().map(|f| f.to_string_lossy().into_owned()))
        .unwrap_or(stem);
    clean_name(&folder)
}

/// Width and height of a PNG, read from its header (no decoding).
pub fn png_size(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() < 24 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" {
        return None;
    }
    let w = u32::from_be_bytes(bytes[16..20].try_into().ok()?);
    let h = u32::from_be_bytes(bytes[20..24].try_into().ok()?);
    Some((w, h))
}

/// Whether a program opens a window: the « subsystem » of its PE header is 2 (GUI), not 3
/// (console). Unreadable: counted as a window (the other filters still apply).
pub fn opens_window(head: &[u8]) -> bool {
    let Some(pe) = head
        .get(0x3C..0x40)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    else {
        return true;
    };
    let at = pe as usize + 0x5C;
    match head.get(at..at + 2) {
        Some(b) if &head[pe as usize..pe as usize + 4] == b"PE\0\0" => {
            u16::from_le_bytes([b[0], b[1]]) != 3
        }
        _ => true,
    }
}

/// The logo of `app` among `files`: a PNG named as its logo (`named_as_logo`), about square, at
/// least 128 px, the sharpest up to 512 px (a 2 000 px splash screen is not a logo). Reviewed
/// 2026-11-04: « any PNG with logo or icon in its name » gave Steam the SteamVR icon, OneDrive the
/// Photos tile, eight Voicemeeter apps one 72 px logo.
pub fn pick_logo(
    files: &Files,
    app: &str,
    read: &dyn Fn(&Path) -> Option<(u32, u32)>,
) -> Option<PathBuf> {
    files
        .iter()
        .filter(|(p, _, size)| {
            let png = p.extension().is_some_and(|e| e.eq_ignore_ascii_case("png"));
            let stem = p.file_stem().unwrap_or_default().to_string_lossy();
            png && named_as_logo(&stem, app) && (1_000..3_000_000).contains(size)
        })
        .filter_map(|(p, depth, _)| {
            let (w, h) = read(p)?;
            let ratio = w as f32 / h.max(1) as f32;
            ((0.8..=1.25).contains(&ratio) && w >= 128)
                .then_some((i64::from(w.min(512)) - *depth as i64 * 40, p))
        })
        .max_by_key(|(s, _)| *s)
        .map(|(_, p)| p.clone())
}
