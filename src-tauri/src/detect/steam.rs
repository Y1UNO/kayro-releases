//! Steam: libraries from `libraryfolders.vdf`, installed games from `appmanifest_*.acf`, posters
//! from the client's own `appcache/librarycache`. Launch goes through `steam://rungameid/<id>`.

use std::fs;
use std::path::{Path, PathBuf};

use keyvalues_parser::{Obj, Value};

use super::filters::is_steam_tool;
use super::{DetectError, DetectSource, DetectedApp, ScanCtx, SourceKind};
use crate::config::apps::{AppSource, Launch, MatchRule};

const DEFAULT_ROOT: &str = "C:\\Program Files (x86)\\Steam";
/// `StateFlags` bit set once the game is fully installed (updates keep it).
const FULLY_INSTALLED: u32 = 4;

pub struct SteamSource {
    /// `None`: ask the registry, then the default install folder.
    root: Option<PathBuf>,
}

impl SteamSource {
    pub fn system() -> Self {
        Self { root: None }
    }

    pub fn with_root(root: PathBuf) -> Self {
        Self { root: Some(root) }
    }
}

impl DetectSource for SteamSource {
    fn kind(&self) -> SourceKind {
        SourceKind::Steam
    }

    fn scan(&self, ctx: &ScanCtx) -> Result<Vec<DetectedApp>, DetectError> {
        let Some(root) = self.root.clone().or_else(find_root) else {
            tracing::info!("steam: not installed, nothing to detect");
            return Ok(Vec::new());
        };
        let mut apps = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for library in libraries(&root, ctx) {
            for app in scan_library(&library, &root, ctx) {
                if ctx.cancelled() {
                    return Ok(apps);
                }
                // The same game can be listed by two libraries after a move: keep the first.
                if seen.insert(app.id.clone()) {
                    apps.push(app);
                }
            }
        }
        apps.sort_by_key(|a| a.name.to_lowercase());
        Ok(apps)
    }
}

/// Steam folder: registry value `HKCU\Software\Valve\Steam\SteamPath`, then the usual place.
fn find_root() -> Option<PathBuf> {
    let from_registry = registry_steam_path().map(|s| PathBuf::from(s.replace('/', "\\")));
    [from_registry, Some(PathBuf::from(DEFAULT_ROOT))]
        .into_iter()
        .flatten()
        .find(|p| p.join("steamapps").is_dir())
}

fn registry_steam_path() -> Option<String> {
    use windows::core::w;
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};

    let mut buf = [0u16; 520];
    let mut bytes = u32::try_from(std::mem::size_of_val(&buf)).ok()?;
    // SAFETY: `buf` and `bytes` outlive the call; `bytes` is the buffer size in bytes.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Valve\\Steam"),
            w!("SteamPath"),
            RRF_RT_REG_SZ,
            None,
            Some(buf.as_mut_ptr().cast()),
            Some(&mut bytes),
        )
    };
    if status.0 != 0 {
        return None;
    }
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    Some(String::from_utf16_lossy(&buf[..len]))
}

fn read_vdf(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    Ok(text.trim_start_matches('\u{feff}').to_string())
}

/// Library folders: the Steam folder itself plus every `path` of `libraryfolders.vdf`.
pub(crate) fn libraries(root: &Path, ctx: &ScanCtx) -> Vec<PathBuf> {
    let mut found = vec![root.to_path_buf()];
    let file = root.join("steamapps").join("libraryfolders.vdf");
    match read_vdf(&file).and_then(|t| parse_library_paths(&t)) {
        Ok(paths) => {
            for p in paths {
                let dup = found.iter().any(|f| {
                    f.to_string_lossy()
                        .eq_ignore_ascii_case(&p.to_string_lossy())
                });
                if !dup {
                    found.push(p);
                }
            }
        }
        Err(e) => {
            ctx.skip("libraryfolders.vdf", &e);
            tracing::warn!(error = %e, "steam: libraryfolders.vdf unreadable, using the Steam folder only");
        }
    }
    found
}

pub(crate) fn parse_library_paths(text: &str) -> Result<Vec<PathBuf>, String> {
    let vdf = keyvalues_parser::parse(text).map_err(|e| e.to_string())?;
    let Value::Obj(root) = &vdf.value else {
        return Err("libraryfolders: root is not an object".into());
    };
    Ok(root
        .0
        .values()
        .flatten()
        .filter_map(Value::get_obj)
        .filter_map(|lib| str_field(lib, "path"))
        .filter(|p| !p.is_empty())
        .map(PathBuf::from)
        .collect())
}

fn str_field<'a>(obj: &'a Obj<'_>, key: &str) -> Option<&'a str> {
    obj.0.get(key)?.first()?.get_str()
}

/// One manifest, reduced to what the hub needs.
#[derive(Debug, PartialEq)]
pub(crate) struct Manifest {
    pub app_id: String,
    pub name: String,
}

pub(crate) fn parse_manifest(text: &str) -> Result<Manifest, String> {
    let vdf = keyvalues_parser::parse(text).map_err(|e| e.to_string())?;
    let Value::Obj(state) = &vdf.value else {
        return Err("appmanifest: root is not an object".into());
    };
    let app_id = str_field(state, "appid").ok_or("no appid")?.trim();
    if app_id.is_empty() || !app_id.bytes().all(|b| b.is_ascii_digit()) || app_id.len() > 12 {
        return Err(format!("invalid appid «{app_id}»"));
    }
    let name = str_field(state, "name").ok_or("no name")?.trim();
    if name.is_empty() {
        return Err("empty name".into());
    }
    // A missing or odd `StateFlags` is tolerated; only a clearly unfinished install is skipped.
    if let Some(flags) = str_field(state, "StateFlags").and_then(|f| f.trim().parse::<u32>().ok()) {
        if flags & FULLY_INSTALLED == 0 {
            return Err(format!("not fully installed (StateFlags {flags})"));
        }
    }
    Ok(Manifest {
        app_id: app_id.to_string(),
        name: name.to_string(),
    })
}

fn scan_library(library: &Path, steam_root: &Path, ctx: &ScanCtx) -> Vec<DetectedApp> {
    let dir = library.join("steamapps");
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(e) => {
            ctx.skip(&dir.to_string_lossy(), &e.to_string());
            tracing::warn!(library = %library.display(), error = %e, "steam: library unreadable");
            return Vec::new();
        }
    };
    let mut apps = Vec::new();
    for entry in entries.flatten() {
        if ctx.cancelled() {
            break;
        }
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if !(file_name.starts_with("appmanifest_") && file_name.ends_with(".acf")) {
            continue;
        }
        let manifest = match read_vdf(&entry.path()).and_then(|t| parse_manifest(&t)) {
            Ok(m) => m,
            Err(e) => {
                ctx.skip(&file_name, &e);
                tracing::warn!(file = %file_name, error = %e, "steam: manifest ignored");
                continue;
            }
        };
        if is_steam_tool(&manifest.app_id, &manifest.name) {
            ctx.skip(&file_name, "steam tool or redistributable");
            continue;
        }
        let (poster, hero) = find_art(steam_root, &manifest.app_id);
        let app = DetectedApp {
            id: format!("steam-{}", manifest.app_id),
            name: manifest.name,
            source: AppSource::Steam {
                app_id: manifest.app_id.clone(),
            },
            launch: Launch::Uri {
                uri: format!("steam://rungameid/{}", manifest.app_id),
            },
            match_rule: MatchRule::default(),
            poster_path: poster.map(|p| p.to_string_lossy().into_owned()),
            hero_path: hero.map(|p| p.to_string_lossy().into_owned()),
            already_added: false,
            suggested_category: String::new(),
        };
        apps.extend(ctx.accept(SourceKind::Steam, app));
    }
    apps
}

/// Best vertical poster and hero in `appcache/librarycache/<appid>`. Steam writes two layouts
/// (files directly in the folder, or one more level of hash-named folders): look at both.
pub(crate) fn find_art(steam_root: &Path, app_id: &str) -> (Option<PathBuf>, Option<PathBuf>) {
    const POSTERS: [&str; 4] = [
        "library_600x900.jpg",
        "library_capsule.jpg",
        "header.jpg",
        "library_header.jpg",
    ];
    let base = steam_root
        .join("appcache")
        .join("librarycache")
        .join(app_id);
    let mut files: Vec<PathBuf> = Vec::new();
    let Ok(top) = fs::read_dir(&base) else {
        return (None, None);
    };
    for entry in top.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Ok(sub) = fs::read_dir(&path) {
                files.extend(sub.flatten().map(|e| e.path()).filter(|p| p.is_file()));
            }
        } else {
            files.push(path);
        }
    }
    let named = |wanted: &str| {
        files
            .iter()
            .find(|p| {
                p.file_name()
                    .is_some_and(|n| n.eq_ignore_ascii_case(wanted))
            })
            .cloned()
    };
    let poster = POSTERS.iter().find_map(|n| named(n));
    (poster, named("library_hero.jpg"))
}

#[cfg(test)]
#[path = "steam_tests.rs"]
mod tests;
