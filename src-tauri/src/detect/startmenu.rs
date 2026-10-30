//! Start Menu: `.lnk` shortcuts of the user and of all users, resolved through the Shell's
//! `IShellLinkW`. The app launches the shortcut itself (`Launch::Lnk`), so arguments and working
//! folder stay exactly as the installer set them.
//!
//! Left out: shortcuts without a target (MSI "advertised" shortcuts, Explorer, Run…), targets
//! that are not programs, uninstallers, read-me files and Windows' own tools. Steam's `.url`
//! shortcuts are not read at all: the Steam source already provides those games.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use windows::core::{IUnknown, Interface, HSTRING};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED, STGM_READ,
};
use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

use super::filters::is_noise_shortcut;
use super::relevance::{clean_name, keep_mask, Candidate};
use super::{short_hash, DetectError, DetectSource, DetectedApp, ScanCtx, SourceKind};
use crate::config::apps::{AppSource, Launch, MatchRule};

const MAX_DEPTH: usize = 8;
const MAX_SHORTCUTS: usize = 5000;

pub struct StartMenuSource {
    roots: Vec<PathBuf>,
    windows_dir: Option<PathBuf>,
}

impl StartMenuSource {
    pub fn system() -> Self {
        let sub = "Microsoft\\Windows\\Start Menu\\Programs";
        let roots = ["APPDATA", "ProgramData"]
            .iter()
            .filter_map(std::env::var_os)
            .map(|base| PathBuf::from(base).join(sub))
            .collect();
        let windows_dir = std::env::var_os("SystemRoot")
            .or_else(|| std::env::var_os("windir"))
            .map(PathBuf::from);
        Self { roots, windows_dir }
    }

    pub fn with_roots(roots: Vec<PathBuf>, windows_dir: Option<PathBuf>) -> Self {
        Self { roots, windows_dir }
    }
}

/// COM for the current thread, released on drop.
struct Com;

impl Com {
    fn init() -> Result<Self, DetectError> {
        // SAFETY: plain initialisation call, balanced by `CoUninitialize` in `Drop`.
        let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        hr.ok()
            .map_err(|e| DetectError(format!("COM init failed: {e}")))?;
        Ok(Com)
    }
}

impl Drop for Com {
    fn drop(&mut self) {
        // SAFETY: only constructed after a successful `CoInitializeEx` on this thread.
        unsafe { CoUninitialize() };
    }
}

#[derive(Debug, PartialEq)]
pub(crate) struct Shortcut {
    pub target: PathBuf,
    pub args: String,
}

fn wide_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
}

/// Reads a `.lnk` file. Needs COM on the calling thread.
pub(crate) fn resolve(link_path: &Path) -> Result<Shortcut, String> {
    // SAFETY: COM calls on interfaces created just above; the buffers outlive each call.
    unsafe {
        let link: IShellLinkW =
            CoCreateInstance(&ShellLink, None::<&IUnknown>, CLSCTX_INPROC_SERVER)
                .map_err(|e| e.to_string())?;
        let file: IPersistFile = link.cast().map_err(|e| e.to_string())?;
        file.Load(&HSTRING::from(link_path.as_os_str()), STGM_READ)
            .map_err(|e| e.to_string())?;
        let mut target = [0u16; 520];
        link.GetPath(&mut target, std::ptr::null_mut(), 0)
            .map_err(|e| e.to_string())?;
        let mut args = [0u16; 1024];
        link.GetArguments(&mut args).map_err(|e| e.to_string())?;
        Ok(Shortcut {
            target: PathBuf::from(wide_to_string(&target)),
            args: wide_to_string(&args),
        })
    }
}

/// Every `.lnk` under `root` (bounded depth and count, symbolic links not followed).
fn find_shortcuts(root: &Path, out: &mut Vec<PathBuf>, ctx: &ScanCtx) {
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        if ctx.cancelled() || out.len() >= MAX_SHORTCUTS {
            return;
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            continue; // folder missing or not readable: nothing to propose from it
        };
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            let path = entry.path();
            if kind.is_dir() && depth < MAX_DEPTH {
                stack.push((path, depth + 1));
            } else if kind.is_file()
                && path
                    .extension()
                    .is_some_and(|e| e.eq_ignore_ascii_case("lnk"))
            {
                out.push(path);
            }
        }
    }
}

/// The Start Menu folder holding a shortcut (`None` at the root, `…\Programs`).
fn folder_of(link: &Path) -> Option<String> {
    let name = link.parent()?.file_name()?.to_string_lossy().into_owned();
    (!name.eq_ignore_ascii_case("programs")).then_some(name)
}

fn shortcut_id(link_path: &Path) -> String {
    format!(
        "menu-{}",
        short_hash(&link_path.to_string_lossy().to_lowercase())
    )
}

impl DetectSource for StartMenuSource {
    fn kind(&self) -> SourceKind {
        SourceKind::Startmenu
    }

    fn scan(&self, ctx: &ScanCtx) -> Result<Vec<DetectedApp>, DetectError> {
        let _com = Com::init()?;
        let mut links = Vec::new();
        for root in &self.roots {
            let mut found = Vec::new();
            find_shortcuts(root, &mut found, ctx);
            found.sort(); // deterministic order: the user's own shortcut wins a duplicate
            links.extend(found);
        }
        let mut seen = HashSet::new();
        let mut found: Vec<(Candidate, DetectedApp)> = Vec::new();
        for link in links {
            if ctx.cancelled() {
                break;
            }
            let label = link.to_string_lossy().into_owned();
            let name = link
                .file_stem()
                .map(|s| clean_name(&s.to_string_lossy()))
                .unwrap_or_default();
            let shortcut = match resolve(&link) {
                Ok(s) => s,
                Err(e) => {
                    ctx.skip(&label, &e);
                    tracing::warn!(file = %label, error = %e, "startmenu: shortcut unreadable");
                    continue;
                }
            };
            if shortcut.target.as_os_str().is_empty() {
                ctx.skip(&label, "no target");
                continue;
            }
            if is_noise_shortcut(&name, &shortcut.target, self.windows_dir.as_deref()) {
                ctx.skip(&label, "uninstaller, document or system tool");
                continue;
            }
            let key = format!(
                "{}|{}",
                shortcut.target.to_string_lossy().to_lowercase(),
                shortcut.args.to_lowercase()
            );
            if !seen.insert(key) {
                ctx.skip(&label, "same target as another shortcut");
                continue;
            }
            let exe = shortcut
                .target
                .file_name()
                .map(|f| f.to_string_lossy().into_owned());
            let candidate = Candidate {
                name: name.clone(),
                folder: folder_of(&link),
                exe_stem: shortcut
                    .target
                    .file_stem()
                    .map(|f| f.to_string_lossy().into_owned())
                    .unwrap_or_default(),
            };
            let app = DetectedApp {
                id: shortcut_id(&link),
                name,
                source: AppSource::Startmenu,
                launch: Launch::Lnk { path: label },
                match_rule: MatchRule { exe },
                poster_path: None,
                hero_path: None,
                already_added: false,
                suggested_category: String::new(),
                launcher: false,
                ignored: false,
                install_dir: shortcut
                    .target
                    .parent()
                    .map(|d| d.to_string_lossy().into_owned()),
                logo_path: None,
            };
            found.push((candidate, app));
        }
        // Review 2026-10-29: only the apps people launch (relevance.rs).
        let mask = keep_mask(&found.iter().map(|(c, _)| c.clone()).collect::<Vec<_>>());
        let mut apps = Vec::new();
        for ((c, app), keep) in found.into_iter().zip(mask) {
            if keep {
                apps.extend(ctx.accept(SourceKind::Startmenu, app));
            } else {
                ctx.skip(&c.name, "helper, variant or side tool of a suite");
            }
        }
        apps.sort_by_key(|a| a.name.to_lowercase());
        Ok(apps)
    }
}

#[cfg(test)]
#[path = "startmenu_tests.rs"]
mod tests;
