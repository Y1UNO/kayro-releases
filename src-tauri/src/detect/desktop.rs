//! The advanced scan's Desktop (2026-11-04): shortcuts and programs put there by hand (a game of
//! one's own, a portable tool) that no installer listed in the Start Menu. The user's Desktop
//! (wherever Windows keeps it, OneDrive included) and the public one; read only, never below.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use windows::Win32::System::Com::CoTaskMemFree;
use windows::Win32::UI::Shell::{
    FOLDERID_Desktop, FOLDERID_PublicDesktop, SHGetKnownFolderPath, KF_FLAG_DEFAULT,
};

use super::category::suggest_category;
use super::deep::{is_window, within};
use super::deep_pick::is_noise_exe;
use super::filters::is_noise_shortcut;
use super::relevance::clean_name;
use super::startmenu::{resolve, Com};
use super::{is_kayro, short_hash, DetectedApp, ScanCtx, SourceKind};
use crate::config::apps::{AppSource, Launch, MatchRule};

/// A Desktop holds a few dozen files; past this, the rest is left alone.
const MAX_FILES: usize = 500;

/// The user's Desktop and the public one, as Windows names them (a Desktop moved to OneDrive is
/// found where it is).
pub fn desktop_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    for id in [FOLDERID_Desktop, FOLDERID_PublicDesktop] {
        // SAFETY: the path the Shell allocated is copied, then freed once.
        unsafe {
            if let Ok(p) = SHGetKnownFolderPath(&id, KF_FLAG_DEFAULT, None) {
                if let Ok(text) = p.to_string() {
                    dirs.push(PathBuf::from(text));
                }
                CoTaskMemFree(Some(p.0 as *const _));
            }
        }
    }
    dirs.dedup();
    dirs
}

/// The name a Desktop entry shows: without « - Raccourci » and without « .exe ».
fn desktop_name(stem: &str) -> String {
    let name = clean_name(stem);
    match name.char_indices().rev().nth(3) {
        Some((i, _)) if i > 0 && name[i..].eq_ignore_ascii_case(".exe") => clean_name(&name[..i]),
        _ => name,
    }
}

fn is_ext(p: &Path, ext: &str) -> bool {
    p.extension().is_some_and(|e| e.eq_ignore_ascii_case(ext))
}

/// The program a Desktop file starts, with the shortcut's own arguments (`None`: not a program,
/// or noise: an uninstaller, a console tool, an installer…).
fn program_of(file: &Path, windows_dir: Option<&Path>) -> Option<(PathBuf, String)> {
    let stem = file.file_stem()?.to_string_lossy().into_owned();
    if is_ext(file, "lnk") {
        let link = resolve(file).ok()?;
        let noise = is_noise_shortcut(&desktop_name(&stem), &link.target, windows_dir);
        return (!noise && link.target.is_file()).then_some((link.target, link.args));
    }
    let size = file.metadata().map_or(0, |m| m.len());
    let program = is_ext(file, "exe") && size > 200_000 && !is_noise_exe(&stem);
    (program && is_window(file)).then(|| (file.to_path_buf(), String::new()))
}

/// Apps on the Desktops `dirs` that no folder of `known` (lower case) holds already.
pub fn scan(dirs: &[PathBuf], known: &HashSet<String>, ctx: &ScanCtx) -> Vec<DetectedApp> {
    let Ok(_com) = Com::init() else {
        return Vec::new();
    };
    let windows_dir = std::env::var_os("SystemRoot").map(PathBuf::from);
    let mut seen = HashSet::new();
    let mut apps = Vec::new();
    for dir in dirs {
        let Ok(read) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in read.flatten().take(MAX_FILES) {
            if ctx.cancelled() {
                return apps;
            }
            let file = entry.path();
            let Some((target, args)) = program_of(&file, windows_dir.as_deref()) else {
                continue;
            };
            if is_kayro(&target) {
                continue;
            }
            let folder = target.parent().unwrap_or(dir);
            let key = folder.to_string_lossy().to_lowercase();
            let path = target.to_string_lossy().into_owned();
            let listed = known.iter().any(|k| within(&key, k) || within(k, &key));
            if listed || !seen.insert(path.to_lowercase()) {
                ctx.skip(&file.to_string_lossy(), "already listed");
                continue;
            }
            let name = desktop_name(&file.file_stem().unwrap_or_default().to_string_lossy());
            let exe = target.file_name().map(|f| f.to_string_lossy().into_owned());
            // Arguments only a shortcut keeps exactly; a plain program is started itself, so the
            // app still works once the Desktop is tidied.
            let launch = if args.is_empty() {
                Launch::Exe {
                    path: path.clone(),
                    args: Vec::new(),
                    cwd: Some(folder.to_string_lossy().into_owned()),
                    elevated: false,
                }
            } else {
                Launch::Lnk {
                    path: file.to_string_lossy().into_owned(),
                }
            };
            let on_desktop = folder == dir.as_path();
            let app = DetectedApp {
                id: format!("deep-{}", short_hash(&path.to_lowercase())),
                suggested_category: suggest_category(&name, exe.as_deref(), None).into(),
                name,
                source: AppSource::Manual,
                launch,
                match_rule: MatchRule { exe },
                poster_path: None,
                hero_path: None,
                already_added: false,
                launcher: false,
                ignored: false,
                // A program lying on the Desktop has no folder of its own to look for a logo in.
                install_dir: (!on_desktop).then(|| folder.to_string_lossy().into_owned()),
                logo_path: None,
            };
            apps.extend(ctx.accept(SourceKind::Deep, app));
        }
    }
    apps
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_names_lose_the_shortcut_and_program_marks() {
        assert_eq!(desktop_name("RAYKA.exe - Raccourci"), "RAYKA");
        assert_eq!(desktop_name("Godot 4.exe"), "Godot 4");
        assert_eq!(desktop_name("Blender"), "Blender");
    }

    #[test]
    fn the_desktops_are_found() {
        let dirs = desktop_dirs();
        assert!(!dirs.is_empty() && dirs.iter().all(|d| d.is_absolute()));
    }
}
