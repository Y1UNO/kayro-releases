//! Which Start Menu shortcuts are worth proposing (review of 2026-10-29). The scan only proposes
//! the apps people launch: games, launchers and the main program of a suite. Helpers, consoles,
//! variants (« safe mode », « OpenGL », « x64 ») and a suite's side tools are left out; the user
//! can still add any of them by hand (drop a file on Kayro, `intake.rs`).
//!
//! Pure functions on names, folders and program names (tested without the Shell).

use std::collections::HashSet;

use super::category::{normalise, suggest_category};

/// Words of a shortcut's name that mark a helper, never the app itself (normalised, whole words).
const HELPER_WORDS: &[&str] = &[
    "about",
    "à propos",
    "check for updates",
    "update",
    "updater",
    "mise à jour",
    "report a problem",
    "safe mode",
    "compatibility mode",
    "mode sans échec",
    "module docs",
    "documentation",
    "docs",
    "help",
    "aide",
    "manual",
    "manuel",
    "configure",
    "configuration",
    "control panel",
    "control panels",
    "panneau de configuration",
    "services",
    "service",
    "driver",
    "drivers",
    "pilote",
    "overlay host",
    "cert kit",
    "sdk",
    "installer",
    "setup",
    "repair",
    "license",
    "licence",
    "website",
    "site web",
    "support",
    "feedback",
    "crash reporter",
    "debug",
    "command prompt",
    "idle python",
    "server",
    "plugins",
    "benchmark",
    "speed test",
];

/// Programs that open a console or a runtime, not an app (file stem, lower case).
const CONSOLE_STEMS: &[&str] = &[
    "cmd",
    "powershell",
    "pwsh",
    "python",
    "pythonw",
    "py",
    "node",
    "java",
    "javaw",
    "javaws",
    "bash",
    "sh",
    "wsl",
    "git-bash",
    "git-cmd",
    "git-gui",
    "wish",
];

/// A name ending with one of these is a variant of the same app (« Dead Cells OpenGL »).
const VARIANT_TAILS: &[&str] = &[
    "x64",
    "x86",
    "64 bit",
    "32 bit",
    "opengl",
    "vulkan",
    "dx11",
    "dx12",
    "directx 11",
    "directx 12",
];

/// Folder words too common to tie a shortcut to its suite.
const GENERIC_WORDS: &[&str] = &[
    "the",
    "and",
    "for",
    "games",
    "game",
    "studio",
    "studios",
    "software",
    "tools",
    "tool",
    "inc",
    "design",
    "corporation",
    "corp",
    "ltd",
    "llc",
    "edition",
    "app",
    "apps",
    "audio",
    "video",
    "windows",
    "microsoft",
];

fn has_words(text: &str, key: &str) -> bool {
    format!(" {text} ").contains(&format!(" {key} "))
}

/// Windows' own apps, already one click away in Windows (normalised names).
const SYSTEM_APPS: &[&str] = &["onedrive", "windows media player legacy"];

/// The name to show: without the « - Raccourci » / « - Shortcut » Windows adds to a copied
/// shortcut, first letter in capitals (« spotify - Raccourci » → « Spotify »).
pub fn clean_name(name: &str) -> String {
    let lower = name.to_lowercase();
    let cut = [" - raccourci", " - shortcut", " – raccourci"]
        .iter()
        .find_map(|t| lower.ends_with(t).then(|| name.len() - t.len()))
        .unwrap_or(name.len());
    let trimmed = name[..cut].trim();
    let mut chars = trimmed.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => name.to_string(),
    }
}

/// Is this shortcut a helper, a console or a runtime (whatever its folder)?
pub fn is_helper(name: &str, exe_stem: &str) -> bool {
    let n = normalise(name);
    HELPER_WORDS.iter().any(|w| has_words(&n, w))
        || SYSTEM_APPS.contains(&n.as_str())
        || CONSOLE_STEMS.contains(&exe_stem.to_lowercase().as_str())
}

/// The name without a variant tail and without brackets: « Voicemeeter Banana x64 » →
/// « voicemeeter banana ».
fn base_name(name: &str) -> String {
    let bare = match (name.find('('), name.ends_with(')')) {
        (Some(i), true) if i > 0 => &name[..i],
        _ => name,
    };
    let mut n = normalise(bare);
    loop {
        let Some(tail) = VARIANT_TAILS
            .iter()
            .find(|t| n.len() > t.len() + 1 && n.ends_with(&format!(" {t}")))
        else {
            return n;
        };
        n.truncate(n.len() - tail.len() - 1);
    }
}

fn significant(text: &str) -> Vec<String> {
    normalise(text)
        .split(' ')
        .filter(|w| w.len() >= 3 && !GENERIC_WORDS.contains(w))
        .map(str::to_string)
        .collect()
}

/// One shortcut as the pruning sees it.
#[derive(Debug, Clone)]
pub struct Candidate {
    pub name: String,
    /// Name of the Start Menu folder holding it (`None` at the root).
    pub folder: Option<String>,
    pub exe_stem: String,
}

/// Which candidates to keep (same order). Rules, in order:
/// 1. helpers, consoles and runtimes go;
/// 2. a variant goes when its base app is there (« Dead Cells OpenGL », « Voicemeeter x64 »), and
///    a second shortcut of the same name goes;
/// 3. in a suite's folder, the shortcuts that do not carry the folder's name go (« Voicemeeter »
///    keeps « Voicemeeter Banana », not « Macro Buttons »), unless they are a known app or no
///    shortcut of the folder carries its name (« Riot Games » keeps all).
pub fn keep_mask(list: &[Candidate]) -> Vec<bool> {
    let mut keep: Vec<bool> = list
        .iter()
        .map(|c| !is_helper(&c.name, &c.exe_stem))
        .collect();

    let bases: HashSet<String> = list
        .iter()
        .zip(&keep)
        .filter(|(_, k)| **k)
        .map(|(c, _)| normalise(&c.name))
        .collect();
    let mut seen = HashSet::new();
    for (i, c) in list.iter().enumerate() {
        if !keep[i] {
            continue;
        }
        let full = normalise(&c.name);
        let base = base_name(&c.name);
        if (base != full && bases.contains(&base)) || !seen.insert(base) {
            keep[i] = false;
        }
    }

    let folders: HashSet<&str> = list.iter().filter_map(|c| c.folder.as_deref()).collect();
    for folder in folders {
        let words = significant(folder);
        if words.is_empty() {
            continue;
        }
        let carries = |c: &Candidate| {
            let n = normalise(&c.name);
            words.iter().any(|w| has_words(&n, w))
        };
        let members: Vec<usize> = (0..list.len())
            .filter(|&i| keep[i] && list[i].folder.as_deref() == Some(folder))
            .collect();
        if members.len() < 2 || !members.iter().any(|&i| carries(&list[i])) {
            continue;
        }
        for i in members {
            let c = &list[i];
            let known = suggest_category(&c.name, Some(&c.exe_stem), None) != "autres";
            if !carries(c) && !known {
                keep[i] = false;
            }
        }
    }
    keep
}

#[cfg(test)]
#[path = "relevance_tests.rs"]
mod tests;
