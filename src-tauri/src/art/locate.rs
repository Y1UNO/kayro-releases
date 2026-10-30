//! Steam's own image cache, `appcache/librarycache/<appid>`, read in place. The client writes its
//! files in several layouts, sometimes mixed in one folder (seen on this PC, 2026-10-14): directly
//! in the folder, or one level deeper in hash-named folders; with language variants
//! (`library_capsule_french.jpg`); the small icon is a `<sha1>.jpg` at the top.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use super::{ArtOrigin, ArtRole, Found};

/// Kayro speaks French: a French variant wins over the plain file, which wins over the others.
const PREFERRED_LANGUAGE: &str = "french";

/// Language suffixes Steam uses in file names. A whitelist, so `library_hero_blur` is never taken
/// for a « blur » variant of `library_hero`.
const LANGUAGES: [&str; 30] = [
    "arabic",
    "brazilian",
    "bulgarian",
    "czech",
    "danish",
    "dutch",
    "english",
    "finnish",
    "french",
    "german",
    "greek",
    "hungarian",
    "indonesian",
    "italian",
    "japanese",
    "koreana",
    "latam",
    "norwegian",
    "polish",
    "portuguese",
    "romanian",
    "russian",
    "schinese",
    "spanish",
    "swedish",
    "tchinese",
    "thai",
    "turkish",
    "ukrainian",
    "vietnamese",
];

/// File stems for a role, best first, and their extension. Landscape headers are not posters: a
/// vertical card would crop them to a strip (the card then keeps its gradient face).
fn stems(role: ArtRole) -> (&'static [&'static str], &'static str) {
    match role {
        ArtRole::Poster => (&["library_600x900", "library_capsule"], "jpg"),
        ArtRole::Hero => (&["library_hero"], "jpg"),
        ArtRole::HeroBlur => (&["library_hero_blur"], "jpg"),
        ArtRole::Logo => (&["logo"], "png"),
        ArtRole::Icon | ArtRole::CharLeft | ArtRole::CharRight => (&[], "jpg"),
    }
}

struct Entry {
    /// Lower-case file name.
    name: String,
    path: PathBuf,
    modified: SystemTime,
    /// Directly in the app's folder (not in a hash-named one).
    top: bool,
}

/// Files of the app's folder and of its sub-folders (one level).
fn list(dir: &Path) -> Vec<Entry> {
    let mut out = Vec::new();
    let Ok(top) = fs::read_dir(dir) else {
        return out;
    };
    for entry in top.flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            if let Ok(sub) = fs::read_dir(entry.path()) {
                out.extend(sub.flatten().filter_map(|e| file(&e, false)));
            }
        } else if let Some(f) = file(&entry, true) {
            out.push(f);
        }
    }
    out
}

fn file(entry: &fs::DirEntry, top: bool) -> Option<Entry> {
    let meta = entry.metadata().ok().filter(|m| m.is_file())?;
    Some(Entry {
        name: entry.file_name().to_string_lossy().to_lowercase(),
        path: entry.path(),
        modified: meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
        top,
    })
}

/// Rank of `name` as a variant of `stem.ext`: 0 French, 1 plain, 2 another language; `None` when
/// it is another file.
fn variant_rank(name: &str, stem: &str, ext: &str) -> Option<u8> {
    let rest = name
        .strip_prefix(stem)?
        .strip_suffix(ext)?
        .strip_suffix('.')?;
    if rest.is_empty() {
        return Some(1);
    }
    let language = rest.strip_prefix('_')?;
    if language == PREFERRED_LANGUAGE {
        Some(0)
    } else if LANGUAGES.contains(&language) {
        Some(2)
    } else {
        None
    }
}

/// Steam's small icon: a 40-hex-digit name at the top of the folder.
fn is_icon(e: &Entry) -> bool {
    e.top
        && e.name
            .strip_suffix(".jpg")
            .is_some_and(|s| s.len() == 40 && s.bytes().all(|b| b.is_ascii_hexdigit()))
}

/// Best image of `role` for the Steam game `app_id`; the newest file wins between equals (an old
/// hash-named folder can stay behind after an update).
pub fn steam(cache: &Path, app_id: &str, role: ArtRole) -> Option<Found> {
    if app_id.is_empty() || app_id.len() > 12 || !app_id.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let files = list(&cache.join(app_id));
    let newest = |candidates: Vec<&Entry>| {
        candidates
            .into_iter()
            .max_by_key(|e| e.modified)
            .map(|e| e.path.clone())
    };
    let found = |path: PathBuf, low_res: bool| Found {
        path,
        origin: ArtOrigin::Steam,
        low_res,
    };
    if role == ArtRole::Icon {
        return newest(files.iter().filter(|e| is_icon(e)).collect()).map(|p| found(p, false));
    }
    let (stems, ext) = stems(role);
    for stem in stems {
        let ranked: Vec<(u8, &Entry)> = files
            .iter()
            .filter_map(|e| variant_rank(&e.name, stem, ext).map(|r| (r, e)))
            .collect();
        let Some(best) = ranked.iter().map(|(r, _)| *r).min() else {
            continue;
        };
        let pick = newest(
            ranked
                .into_iter()
                .filter(|(r, _)| *r == best)
                .map(|(_, e)| e)
                .collect(),
        );
        if let Some(path) = pick {
            return Some(found(path, *stem == "library_capsule"));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn variants_are_ranked_french_plain_other() {
        assert_eq!(
            variant_rank("library_capsule_french.jpg", "library_capsule", "jpg"),
            Some(0)
        );
        assert_eq!(
            variant_rank("library_capsule.jpg", "library_capsule", "jpg"),
            Some(1)
        );
        assert_eq!(
            variant_rank("library_capsule_german.jpg", "library_capsule", "jpg"),
            Some(2)
        );
        // `_blur` is not a language: the blurred hero is not a variant of the hero.
        assert_eq!(
            variant_rank("library_hero_blur.jpg", "library_hero", "jpg"),
            None
        );
        assert_eq!(
            variant_rank("library_hero.png", "library_hero", "jpg"),
            None
        );
        assert_eq!(variant_rank("logo.png", "logo", "png"), Some(1));
    }
}
