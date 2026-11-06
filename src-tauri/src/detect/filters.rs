//! What is *not* an app worth proposing: Steam runtimes and redistributables, uninstallers,
//! read-me files, documents and Windows' own tools.

use std::path::Path;

/// Steam entries that are never games: Steamworks Common Redistributables, Linux runtimes and
/// Proton builds.
const STEAM_TOOL_APPIDS: [&str; 6] = [
    "228980",  // Steamworks Common Redistributables
    "1070560", // Steam Linux Runtime 1.0 (scout)
    "1391110", // Steam Linux Runtime 2.0 (soldier)
    "1628350", // Steam Linux Runtime 3.0 (sniper)
    "1493710", // Proton Experimental
    "2180100", // Proton Hotfix
];

const STEAM_TOOL_NAMES: [&str; 8] = [
    "steamworks",
    "dedicated server",
    "soundtrack",
    " sdk",
    "proton",
    "steam linux runtime",
    "redistributable",
    "steam controller configs",
];

pub fn is_steam_tool(app_id: &str, name: &str) -> bool {
    if STEAM_TOOL_APPIDS.contains(&app_id) {
        return true;
    }
    let lower = name.to_lowercase();
    STEAM_TOOL_NAMES.iter().any(|t| lower.contains(t))
}

const SHORTCUT_NAME_MARKERS: [&str; 10] = [
    "uninstall",
    "désinstall",
    "desinstall",
    "unwise",
    "readme",
    "read me",
    "lisez-moi",
    "lisez moi",
    "release notes",
    "notes de version",
];

const TARGET_FILE_MARKERS: [&str; 3] = ["unins", "uninst", "uninstall"];

/// Should a Start Menu shortcut be left out? `target` is its resolved destination.
pub fn is_noise_shortcut(name: &str, target: &Path, windows_dir: Option<&Path>) -> bool {
    let is_exe = target
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("exe"));
    if !is_exe {
        return true; // documents, .msc consoles, .ini, folders…
    }
    let lower_name = name.to_lowercase();
    if SHORTCUT_NAME_MARKERS.iter().any(|m| lower_name.contains(m)) {
        return true;
    }
    let file = target
        .file_stem()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if TARGET_FILE_MARKERS.iter().any(|m| file.starts_with(m)) {
        return true;
    }
    // Windows' own tools (Event Viewer, Registry Editor…): too much noise to propose.
    windows_dir.is_some_and(|w| starts_with_ignore_case(target, w))
}

fn starts_with_ignore_case(path: &Path, prefix: &Path) -> bool {
    let (p, q) = (
        path.to_string_lossy().to_lowercase().replace('/', "\\"),
        prefix.to_string_lossy().to_lowercase().replace('/', "\\"),
    );
    let q = q.trim_end_matches('\\');
    p == q || p.starts_with(&format!("{q}\\"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn steam_redistributables_and_runtimes_are_tools() {
        assert!(is_steam_tool(
            "228980",
            "Steamworks Common Redistributables"
        ));
        assert!(is_steam_tool("999", "Proton 9.0"));
        assert!(is_steam_tool("999", "Steam Linux Runtime 3.0 (sniper)"));
        assert!(!is_steam_tool("1145350", "Demo Game"));
    }

    #[test]
    fn uninstallers_readmes_and_documents_are_noise() {
        let w = PathBuf::from("C:\\Windows");
        let exe = |s: &str| PathBuf::from(s);
        assert!(is_noise_shortcut(
            "Uninstall Foo",
            &exe("C:\\Foo\\foo.exe"),
            Some(&w)
        ));
        assert!(is_noise_shortcut(
            "Désinstaller Foo",
            &exe("C:\\Foo\\foo.exe"),
            Some(&w)
        ));
        assert!(is_noise_shortcut(
            "Foo",
            &exe("C:\\Foo\\unins000.exe"),
            Some(&w)
        ));
        assert!(is_noise_shortcut(
            "ReadMe",
            &exe("C:\\Foo\\foo.exe"),
            Some(&w)
        ));
        assert!(is_noise_shortcut(
            "Foo Help",
            &exe("C:\\Foo\\foo.chm"),
            Some(&w)
        ));
        assert!(is_noise_shortcut(
            "Event Viewer",
            &exe("C:\\Windows\\System32\\eventvwr.msc"),
            Some(&w)
        ));
        assert!(is_noise_shortcut(
            "Registry",
            &exe("c:\\windows\\regedit.exe"),
            Some(&w)
        ));
        assert!(!is_noise_shortcut(
            "Foo",
            &exe("C:\\Foo\\foo.exe"),
            Some(&w)
        ));
        assert!(!is_noise_shortcut(
            "Foo",
            &exe("C:\\Windowsill\\foo.exe"),
            Some(&w)
        ));
    }
}
