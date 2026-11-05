//! The user's apps as the brain is told them (2026-11-05). The scan finds some apps several times
//! (« Voicemeeter », « Voicemeeter x64 », « Python 3.11 », « Python 3.13 », « FL Studio 2024 »
//! and « 2026 », « Dead Cells (OpenGL) »): the brain sees one of each, the one the voice launches
//! (the favourite, else the newest, else the shortest name); the others are its siblings, and
//! closing, windows and sound take whichever runs. Each is told with what it is (« comet = Comet
//! (navigateur) »), so that « ouvre mon navigateur » or « lance mon logiciel de montage » has a
//! target. The utilities (« Check For Updates », « Module Docs ») are left out of the voice only.
//! Games (Steam, Epic) are never grouped: « Slay the Spire » and « Slay the Spire 2 » are two.

use std::collections::HashMap;

use crate::voice::command::Named;

/// One app as the voice needs it.
pub struct Known<'a> {
    pub id: &'a str,
    pub name: &'a str,
    /// Kayro's category (« jeux », « logiciels », « creativite », « stream », « autres »).
    pub category: &'a str,
    /// From Steam or Epic: a game, never grouped.
    pub store_game: bool,
    pub favorite: bool,
}

/// The apps as the brain hears them, and which ids go together.
#[derive(Debug, Default)]
pub struct Spoken {
    /// One per app, favourites first, named with what it is.
    pub apps: Vec<Named>,
    /// Each app's id → the id the brain knows it by.
    rep: HashMap<String, String>,
}

impl Spoken {
    /// The id the brain knows this app by (itself, or the sibling it was grouped under).
    pub fn represent(&self, id: &str) -> Option<&str> {
        self.rep.get(id).map(String::as_str)
    }

    /// The app and its siblings (the same app installed or found twice).
    pub fn members(&self, id: &str) -> Vec<String> {
        let Some(rep) = self.rep.get(id) else {
            return vec![id.to_string()];
        };
        let mut all: Vec<String> = self
            .rep
            .iter()
            .filter(|(_, r)| *r == rep)
            .map(|(m, _)| m.clone())
            .collect();
        all.sort();
        // The one asked for first.
        if let Some(i) = all.iter().position(|m| m == id) {
            all.swap(0, i);
        }
        all
    }
}

/// Never said to launch (installers' and docs' entries of the Start menu).
const UTILITIES: [&str; 11] = [
    "uninstall",
    "désinstall",
    "desinstall",
    "module docs",
    "check for updates",
    "about java",
    "configure java",
    "release notes",
    "readme",
    "documentation",
    "user guide",
];

/// What an app is, by a word of its name: the brain hears « mon navigateur », « mon logiciel de
/// montage » (first match wins).
const ROLES: [(&[&str], &str); 26] = [
    (
        &[
            "comet", "edge", "opera", "chrome", "firefox", "brave", "vivaldi",
        ],
        "navigateur",
    ),
    (&["spotify", "deezer", "tidal", "apple music"], "musique"),
    (
        &[
            "discord", "whatsapp", "teams", "skype", "telegram", "slack", "signal",
        ],
        "messagerie",
    ),
    (
        &["obs", "streamlabs", "streamlabels"],
        "stream et enregistrement de l'écran",
    ),
    (&["medal"], "clips de jeu"),
    (
        &["davinci resolve", "premiere", "capcut", "vegas"],
        "montage vidéo",
    ),
    (&["fl studio", "ableton", "reaper"], "création musicale"),
    (&["audacity"], "enregistrement audio"),
    (&["blender", "blockbench"], "3D"),
    (&["unity", "godot", "unreal"], "création de jeux"),
    (&["visual studio code", "vscode"], "code"),
    (
        &["terminal", "git bash", "git cmd", "powershell"],
        "terminal",
    ),
    (&["obsidian", "onenote", "notion"], "notes"),
    (
        &[
            "steam",
            "epic games",
            "gog galaxy",
            "xbox",
            "client riot",
            "riot client",
        ],
        "boutique de jeux",
    ),
    (
        &[
            "launcher",
            "curseforge",
            "modrinth",
            "overwolf",
            "ftb",
            "redlauncher",
        ],
        "lanceur de jeu",
    ),
    (&["thunderstore", "vortex", "mod manager"], "mods"),
    (
        &[
            "voicemeeter",
            "realtek audio",
            "vban",
            "equalizer",
            "graphic eq",
        ],
        "réglages audio",
    ),
    (
        &[
            "afterburner",
            "hwmonitor",
            "cpu-z",
            "ryzen master",
            "rivatuner",
            "frameview",
            "crystaldiskinfo",
            "crystaldiskmark",
            "nvidia app",
        ],
        "matériel et surveillance du PC",
    ),
    (&["nvidia broadcast"], "micro et caméra"),
    (&["hue sync"], "lumières"),
    (&["winrar", "7-zip"], "archives"),
    (&["claude", "open webui", "grand sage"], "assistant IA"),
    (&["wallpaper engine"], "fond d'écran animé"),
    (&["lossless scaling"], "mise à l'échelle des jeux"),
    (&["screentogif"], "capture en GIF"),
    (&["media player", "vlc", "raw player"], "lecteur vidéo"),
];

fn role(k: &Known) -> Option<&'static str> {
    let name = k.name.to_lowercase();
    let by_name = ROLES
        .iter()
        .find(|(words, _)| words.iter().any(|w| contains_word(&name, w)))
        .map(|(_, r)| *r);
    by_name.or(match k.category {
        _ if k.store_game => Some("jeu"),
        "jeux" => Some("jeu"),
        "creativite" => Some("création"),
        "stream" => Some("stream"),
        _ => None,
    })
}

/// `word` in `name` on word boundaries (« obs » in « OBS Studio », not in « Obsidian »).
fn contains_word(name: &str, word: &str) -> bool {
    let edge = |c: Option<char>| c.is_none_or(|c| !c.is_alphanumeric());
    name.match_indices(word).any(|(i, _)| {
        edge(name[..i].chars().next_back()) && edge(name[i + word.len()..].chars().next())
    })
}

fn utility(name: &str) -> bool {
    let n = name.to_lowercase();
    UTILITIES.iter().any(|u| n.contains(u))
}

fn bits(t: &str) -> bool {
    matches!(t, "x64" | "x86" | "64-bit" | "32-bit" | "64bit" | "32bit")
}

fn version(t: &str) -> Option<Vec<u32>> {
    let numeric =
        t.chars().any(|c| c.is_ascii_digit()) && t.chars().all(|c| c.is_ascii_digit() || c == '.');
    numeric.then(|| t.split('.').filter_map(|p| p.parse().ok()).collect())
}

/// The name outside « (…) » and « […] », without ® and ™.
fn outside(name: &str) -> String {
    let mut plain = String::new();
    let mut depth = 0usize;
    for c in name.chars() {
        match c {
            '(' | '[' => depth += 1,
            ')' | ']' => depth = depth.saturating_sub(1),
            '®' | '™' => {}
            c if depth == 0 => plain.push(c),
            _ => {}
        }
    }
    plain
}

/// The name without what tells copies apart: « (OpenGL) », « x64 », « 2026 », « Player ».
fn bare(name: &str) -> (String, Vec<u32>) {
    let mut ver = Vec::new();
    let words: Vec<String> = outside(name)
        .to_lowercase()
        .split_whitespace()
        .filter(|t| !bits(t) && !matches!(*t, "player" | "launcher"))
        .filter(|t| match version(t) {
            Some(v) => {
                if ver.is_empty() {
                    ver = v;
                }
                false
            }
            None => true,
        })
        .map(String::from)
        .collect();
    let key = if words.is_empty() {
        name.to_lowercase()
    } else {
        words.join(" ")
    };
    (key, ver)
}

/// The name a group is told by: the chosen one's, without « (…) », « x64 » and its version.
fn group_name(name: &str) -> String {
    let plain = outside(name);
    let words: Vec<&str> = plain
        .split_whitespace()
        .filter(|t| !bits(&t.to_lowercase()) && version(t).is_none())
        .collect();
    if words.is_empty() {
        name.trim().to_string()
    } else {
        words.join(" ")
    }
}

/// Kayro's apps as the brain is told them.
pub fn of_config(apps: &[crate::config::apps::AppEntry]) -> Spoken {
    use crate::config::apps::AppSource;
    let known: Vec<Known> = apps
        .iter()
        .map(|a| Known {
            id: &a.id,
            name: &a.name,
            category: &a.category,
            store_game: matches!(a.source, AppSource::Steam { .. } | AppSource::Epic { .. }),
            favorite: a.favorite,
        })
        .collect();
    spoken(&known)
}

pub fn spoken(apps: &[Known]) -> Spoken {
    // Group by bare name (games alone), keeping the user's order.
    let mut groups: Vec<(String, Vec<usize>)> = Vec::new();
    for (i, a) in apps.iter().enumerate() {
        if utility(a.name) {
            continue;
        }
        let key = if a.store_game {
            format!("\u{0}{}", a.id)
        } else {
            bare(a.name).0
        };
        match groups.iter_mut().find(|(k, _)| *k == key) {
            Some((_, members)) => members.push(i),
            None => groups.push((key, vec![i])),
        }
    }
    let mut out = Spoken::default();
    let mut told: Vec<(bool, Named)> = Vec::new();
    for (_, members) in &groups {
        let chosen = *members
            .iter()
            .max_by(|&&x, &&y| {
                let (a, b) = (&apps[x], &apps[y]);
                a.favorite
                    .cmp(&b.favorite)
                    .then_with(|| bare(a.name).1.cmp(&bare(b.name).1))
                    .then_with(|| b.name.len().cmp(&a.name.len()))
                    .then_with(|| y.cmp(&x))
            })
            .expect("a group has a member");
        let c = &apps[chosen];
        let name = if members.len() > 1 {
            group_name(c.name)
        } else {
            // « x64 » is never said.
            let words: Vec<&str> = c
                .name
                .split_whitespace()
                .filter(|t| !bits(&t.to_lowercase()))
                .collect();
            if words.is_empty() {
                c.name.trim().to_string()
            } else {
                words.join(" ")
            }
        };
        let told_name = match role(c) {
            Some(r) => format!("{name} ({r})"),
            None => name,
        };
        for &m in members {
            out.rep.insert(apps[m].id.to_string(), c.id.to_string());
        }
        let favorite = members.iter().any(|&m| apps[m].favorite);
        told.push((
            favorite,
            Named {
                id: c.id.to_string(),
                name: told_name,
            },
        ));
    }
    // Favourites first (« la première » of a kind is the one the user prefers).
    told.sort_by_key(|(f, _)| !*f);
    out.apps = told.into_iter().map(|(_, n)| n).collect();
    out
}

#[cfg(test)]
#[path = "apps_tests.rs"]
mod tests;
