//! Category proposed for an app from its name and program. A suggestion only: the user can change
//! it before adding. Matching is on whole words (`obs` must not match «Robson»).

use super::SourceKind;

const STREAM: &[&str] = &[
    "obs",
    "streamlabs",
    "streamelements",
    "twitch",
    "xsplit",
    "voicemod",
    "vtube",
    "elgato",
    "nvidia broadcast",
    "prism live",
];

const CREATIVE: &[&str] = &[
    "photoshop",
    "illustrator",
    "premiere",
    "after effects",
    "lightroom",
    "blender",
    "davinci",
    "figma",
    "krita",
    "gimp",
    "inkscape",
    "audacity",
    "fl studio",
    "ableton",
    "reaper",
    "unity",
    "unreal",
    "godot",
    "aseprite",
    "affinity",
    "cinema 4d",
    "clip studio",
    "paint",
    "capcut",
    "handbrake",
];

const GAMES: &[&str] = &[
    "steam",
    "epic games",
    "battle net",
    "ubisoft connect",
    "gog galaxy",
    "ea app",
    "riot",
    "minecraft",
    "league of legends",
    "valorant",
    "fortnite",
    "roblox",
    "playnite",
];

const SOFTWARE: &[&str] = &[
    "word",
    "excel",
    "powerpoint",
    "outlook",
    "onenote",
    "chrome",
    "firefox",
    "edge",
    "brave",
    "vlc",
    "spotify",
    "discord",
    "7-zip",
    "winrar",
    "notepad",
    "visual studio",
    "code",
    "git",
    "docker",
    "terminal",
    "powershell",
    "calculator",
    "calculatrice",
    "teams",
    "zoom",
    "slack",
    "notion",
    "obsidian",
];

/// Lower-case words of `text`, separated by single spaces (`Battle.net` → `battle net`).
pub(crate) fn normalise(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars().flat_map(char::to_lowercase) {
        if c.is_alphanumeric() {
            out.push(c);
        } else if !out.ends_with(' ') && !out.is_empty() {
            out.push(' ');
        }
    }
    out.trim_end().to_string()
}

/// Does `keyword` (one or more words) appear as whole words in `haystack`? Both normalised.
fn has_words(haystack: &str, keyword: &str) -> bool {
    let key = normalise(keyword);
    let padded = format!(" {haystack} ");
    padded.contains(&format!(" {key} "))
}

fn any_match(haystack: &str, list: &[&str]) -> bool {
    list.iter().any(|k| has_words(haystack, k))
}

/// One of `jeux`, `stream`, `creativite`, `logiciels`, `autres`.
pub fn suggest_category(name: &str, exe: Option<&str>, source: Option<SourceKind>) -> &'static str {
    if matches!(source, Some(SourceKind::Steam | SourceKind::Epic)) {
        return "jeux";
    }
    let exe_stem = exe
        .map(|e| e.trim_end_matches(".exe").trim_end_matches(".EXE"))
        .unwrap_or("");
    let text = normalise(&format!("{name} {exe_stem}"));
    if any_match(&text, STREAM) {
        "stream"
    } else if any_match(&text, CREATIVE) {
        "creativite"
    } else if any_match(&text, GAMES) {
        "jeux"
    } else if any_match(&text, SOFTWARE) {
        "logiciels"
    } else {
        "autres"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(name: &str) -> &'static str {
        suggest_category(name, None, Some(SourceKind::Startmenu))
    }

    #[test]
    fn launchers_and_known_apps_land_in_the_right_category() {
        assert_eq!(s("OBS Studio"), "stream");
        assert_eq!(s("Streamlabs Desktop"), "stream");
        assert_eq!(s("Adobe Photoshop 2025"), "creativite");
        assert_eq!(s("Blender 4.2"), "creativite");
        assert_eq!(s("Battle.net"), "jeux");
        assert_eq!(s("Minecraft Launcher"), "jeux");
        assert_eq!(s("Discord"), "logiciels");
        assert_eq!(s("Google Chrome"), "logiciels");
    }

    #[test]
    fn unknown_names_stay_in_autres() {
        assert_eq!(s("Frobnicator"), "autres");
        assert_eq!(s(""), "autres");
    }

    #[test]
    fn whole_words_only() {
        assert_eq!(s("Robson Tools"), "autres");
        assert_eq!(s("Wordpad Clone"), "autres");
        assert_eq!(s("Bridge Of Code"), "logiciels");
    }

    #[test]
    fn steam_and_epic_games_are_games_whatever_the_name() {
        assert_eq!(
            suggest_category("OBS Overlay Tycoon", None, Some(SourceKind::Steam)),
            "jeux"
        );
        assert_eq!(
            suggest_category("Anything", None, Some(SourceKind::Epic)),
            "jeux"
        );
    }

    #[test]
    fn the_program_name_counts_too() {
        assert_eq!(
            suggest_category("Mon outil", Some("obs64.exe"), None),
            "autres"
        );
        assert_eq!(
            suggest_category("Mon outil", Some("obs.exe"), None),
            "stream"
        );
    }
}
