//! Palettes of every app, kept in `cache/palettes.json` (rebuilt on demand, never exported). Each
//! entry carries the fingerprint of its source (file + size + date): when Steam or the user changes
//! an image, the palette is computed again; otherwise it is only read back.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::palette::{extract, Palette};
use super::{find, stamp, ArtRole, ArtRoots, MAX_BYTES};
use crate::config::apps::AppEntry;

const SCHEMA_VERSION: u32 = 1;

/// Which image a palette was taken from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PaletteSource {
    Poster,
    Hero,
    /// The program's icon (or Steam's small one), for apps with neither poster nor hero.
    Icon,
}

impl PaletteSource {
    fn slug(self) -> &'static str {
        match self {
            PaletteSource::Poster => "poster",
            PaletteSource::Hero => "hero",
            PaletteSource::Icon => "icon",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppPalette {
    pub id: String,
    pub source: PaletteSource,
    pub palette: Palette,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct Entry {
    fingerprint: String,
    /// `None`: the image could not be read; tried again only when it changes.
    palette: Option<Palette>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CacheFile {
    schema_version: u32,
    entries: BTreeMap<String, Entry>,
}

/// Where the bytes of a source come from.
enum Input {
    File(PathBuf),
    /// The Shell icon of the program (cached PNG in `cache/icons/`).
    ShellIcon,
}

/// What the page receives, and how long the work took (for the logs and the report).
#[derive(Debug, Default)]
pub struct Refresh {
    pub palettes: Vec<AppPalette>,
    pub computed: usize,
    pub failed: usize,
    pub changed: bool,
    pub millis: u128,
}

/// The sources of an app: its poster and its hero; its icon when it has neither.
fn sources(roots: &ArtRoots, app: &AppEntry) -> Vec<(PaletteSource, Input, String)> {
    let file = |role| {
        let path = find(roots, app, role)?.path;
        let fp = format!(
            "{}|{}",
            path.to_string_lossy().to_lowercase(),
            stamp(&path)?
        );
        Some((Input::File(path), fp))
    };
    let mut out = Vec::new();
    for (source, role) in [
        (PaletteSource::Poster, ArtRole::Poster),
        (PaletteSource::Hero, ArtRole::Hero),
    ] {
        if let Some((input, fp)) = file(role) {
            out.push((source, input, fp));
        }
    }
    if out.is_empty() {
        if let Some(src) = crate::icons::icon_source(app) {
            let fp = format!("shell|{}", src.to_lowercase());
            out.push((PaletteSource::Icon, Input::ShellIcon, fp));
        } else if let Some((input, fp)) = file(ArtRole::Icon) {
            out.push((PaletteSource::Icon, input, fp));
        }
    }
    out
}

fn load(path: &Path) -> CacheFile {
    let parsed = fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<CacheFile>(&bytes).ok());
    match parsed {
        Some(file) if file.schema_version == SCHEMA_VERSION => file,
        // Missing, unreadable or from another version: a cache, so it is simply rebuilt.
        _ => CacheFile {
            schema_version: SCHEMA_VERSION,
            entries: BTreeMap::new(),
        },
    }
}

/// Brings `cache_file` up to date with the apps and their images, and returns every palette.
/// `icon_png` gives the PNG of a program's icon (the Shell, or a fake in tests).
pub fn refresh(
    roots: &ArtRoots,
    apps: &[AppEntry],
    cache_file: &Path,
    icon_png: &dyn Fn(&AppEntry) -> Option<Vec<u8>>,
) -> Refresh {
    let start = Instant::now();
    let mut cache = load(cache_file);
    let mut fresh = BTreeMap::new();
    let mut out = Refresh::default();
    for app in apps {
        for (source, input, fingerprint) in sources(roots, app) {
            let key = format!("{}/{}", app.id, source.slug());
            let entry = match cache.entries.remove(&key) {
                Some(e) if e.fingerprint == fingerprint => e,
                _ => {
                    let bytes = match &input {
                        Input::File(path) => fs::metadata(path)
                            .ok()
                            .filter(|m| m.len() <= MAX_BYTES)
                            .and_then(|_| fs::read(path).ok()),
                        Input::ShellIcon => icon_png(app),
                    };
                    let palette = bytes.and_then(|b| match extract(&b) {
                        Ok(p) => Some(p),
                        Err(e) => {
                            tracing::warn!(app = %app.id, source = source.slug(), error = %e, "palette: image refused");
                            None
                        }
                    });
                    out.computed += 1;
                    out.failed += usize::from(palette.is_none());
                    out.changed = true;
                    Entry {
                        fingerprint,
                        palette,
                    }
                }
            };
            if let Some(palette) = &entry.palette {
                out.palettes.push(AppPalette {
                    id: app.id.clone(),
                    source,
                    palette: palette.clone(),
                });
            }
            fresh.insert(key, entry);
        }
    }
    // Entries of removed apps or images are dropped.
    out.changed |= !cache.entries.is_empty();
    if out.changed {
        let file = CacheFile {
            schema_version: SCHEMA_VERSION,
            entries: fresh,
        };
        let written = serde_json::to_vec(&file)
            .map_err(std::io::Error::other)
            .and_then(|bytes| {
                cache_file
                    .parent()
                    .map_or(Ok(()), fs::create_dir_all)
                    .and_then(|()| crate::config::atomic::write_atomic(cache_file, &bytes))
            });
        if let Err(e) = written {
            // The palettes are still given to the page; only the cache is missing.
            tracing::warn!(error = %e, "palette: could not save the cache");
        }
    }
    out.millis = start.elapsed().as_millis();
    out
}

#[cfg(test)]
#[path = "palettes_tests.rs"]
mod tests;
