//! Where an app lives on disk, for the apps that have neither `match.exe` nor a program path
//! (step 24): a Steam or Epic game (its install folder), a shortcut (the folder of its program).
//! Such an app is open when one of its processes runs from that folder. A folder too general
//! (a drive, Program Files, AppData…) is refused: it would make unrelated programs count.

use std::path::{Path, PathBuf};

use crate::config::apps::{AppEntry, AppSource, Launch};
use crate::detect::{epic, startmenu, steam};

/// The app's folder, lower case with a trailing `\` (ready to compare), or `None`.
pub fn install_folder(app: &AppEntry) -> Option<String> {
    let found = match (&app.source, &app.launch) {
        (_, Launch::Exe { .. } | Launch::Uwp { .. } | Launch::Url { .. }) => None,
        (AppSource::Steam { app_id }, _) => steam::game_folder(app_id),
        (AppSource::Epic { app_name }, _) => epic_folder(app_name),
        (_, Launch::Uri { uri }) => steam_id(uri).and_then(steam::game_folder),
        (_, Launch::Lnk { path }) => shortcut_folder(Path::new(path)),
    }?;
    let folder = norm(&found.to_string_lossy());
    specific(&folder, &general_folders()).then(|| format!("{folder}\\"))
}

fn epic_folder(app_name: &str) -> Option<PathBuf> {
    let data = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".into());
    let manifests = PathBuf::from(data).join("Epic\\EpicGamesLauncher\\Data\\Manifests");
    epic::install_folder(&manifests, app_name)
}

/// The folder of a shortcut's program (`.exe` only). Needs COM on this thread.
fn shortcut_folder(link: &Path) -> Option<PathBuf> {
    let target = startmenu::resolve(link).ok()?.target;
    let exe = target
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("exe"));
    if exe {
        target.parent().map(Path::to_path_buf)
    } else {
        None
    }
}

/// The game id of `steam://rungameid/<id>` or `steam://run/<id>`.
pub fn steam_id(uri: &str) -> Option<&str> {
    let lower = uri.to_ascii_lowercase();
    let rest = ["steam://rungameid/", "steam://run/"]
        .iter()
        .find_map(|p| lower.starts_with(p).then(|| &uri[p.len()..]))?;
    let end = rest
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(rest.len());
    (end > 0).then(|| &rest[..end])
}

/// Lower case, `\` separators, no trailing separator.
pub fn norm(path: &str) -> String {
    path.replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}

/// Folders that hold many programs: never an app's own folder.
fn general_folders() -> Vec<String> {
    let env = |k: &str| std::env::var(k).ok();
    let mut out = Vec::new();
    for k in [
        "SystemRoot",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramW6432",
        "ProgramData",
        "USERPROFILE",
        "LOCALAPPDATA",
        "APPDATA",
        "PUBLIC",
    ] {
        if let Some(v) = env(k) {
            out.push(norm(&v));
        }
    }
    let join = |k: &str, rest: &str| env(k).map(|v| norm(&format!("{v}\\{rest}")));
    out.extend(
        [
            join("SystemRoot", "System32"),
            join("ProgramFiles", "Common Files"),
            join("ProgramFiles(x86)", "Common Files"),
            join("ProgramFiles", "WindowsApps"),
            join("LOCALAPPDATA", "Programs"),
            join("LOCALAPPDATA", "Microsoft\\WindowsApps"),
            join("USERPROFILE", "Desktop"),
            join("USERPROFILE", "Documents"),
            join("USERPROFILE", "Downloads"),
        ]
        .into_iter()
        .flatten(),
    );
    out
}

/// True when `folder` (normalised) is an app's own: not a drive, not one of the `general`
/// folders, not above one of them (`c:\users`).
pub fn specific(folder: &str, general: &[String]) -> bool {
    if folder.split('\\').filter(|p| !p.is_empty()).count() < 2 {
        return false;
    }
    !general
        .iter()
        .any(|g| g == folder || g.starts_with(&format!("{folder}\\")))
}

/// True when the program `exe` (normalised) runs from `folder` (normalised, trailing `\`). A
/// launcher's folder does not cover its library (Steam's own `steamapps`).
pub fn runs_from(exe: &str, folder: &str) -> bool {
    exe.strip_prefix(folder)
        .is_some_and(|rest| !rest.starts_with("steamapps\\"))
}
