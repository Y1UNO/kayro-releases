//! Personal themes (step 15): `themes/<id>.json`, made in Réglages › Thèmes or imported from a
//! `.json` file. Strict like scenes: a file that does not fit its schema exactly is refused.
//! Their ids all start with `perso-`, so they can never shadow a built-in theme.

use std::fs;
use std::path::{Path, PathBuf};

use super::atomic::write_atomic;
use super::schema::{StrictFile, ThemeFile};
use super::{deaccent, lock, ConfigState};
use crate::error::AppError;

/// At most this many personal themes.
pub const MAX_THEMES: usize = 20;
/// An imported theme file is read only below this size.
const MAX_IMPORT_BYTES: u64 = 64 * 1024;
pub const PREFIX: &str = "perso-";

/// `Forêt du soir` → `perso-foret-du-soir`; `-2`, `-3`… appended when the id is taken.
pub(super) fn theme_id(name: &str, taken: impl Fn(&str) -> bool) -> String {
    let mut slug = String::new();
    for c in name.to_lowercase().chars().map(deaccent) {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    // 40 characters at most, `perso-` and a `-NN` suffix included.
    let slug: String = slug.trim_matches('-').chars().take(30).collect();
    let base = match slug.trim_end_matches('-') {
        "" => format!("{PREFIX}theme"),
        s => format!("{PREFIX}{s}"),
    };
    if !taken(&base) {
        return base;
    }
    (2u32..100)
        .map(|n| format!("{base}-{n}"))
        .find(|id| !taken(id))
        .unwrap_or(base)
}

/// Reads a theme file the user dropped: its name and size are looked at before it is opened.
fn read_import(path: &Path) -> Result<ThemeFile, String> {
    if !path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("json"))
    {
        return Err("not a .json file".into());
    }
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if !meta.is_file() || meta.len() > MAX_IMPORT_BYTES {
        return Err("not a regular file, or too large".into());
    }
    let theme: ThemeFile = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    theme.check()?;
    Ok(theme)
}

impl ConfigState {
    pub fn themes(&self) -> Vec<ThemeFile> {
        lock(&self.themes).clone()
    }

    /// A personal theme id no theme uses yet, derived from `name`.
    pub fn new_theme_id(&self, name: &str) -> String {
        let themes = lock(&self.themes);
        theme_id(name, |id| themes.iter().any(|t| t.id == id))
    }

    /// Validates then writes `themes/<id>.json` (replacing the theme with the same id).
    pub fn save_theme(&self, theme: ThemeFile) -> Result<ThemeFile, AppError> {
        theme
            .check()
            .map_err(|message| AppError::validation("theme", message))?;
        if !theme.id.starts_with(PREFIX) {
            return Err(AppError::validation(
                "id",
                "a personal theme id starts with «perso-»",
            ));
        }
        let mut guard = lock(&self.themes);
        let is_new = !guard.iter().any(|t| t.id == theme.id);
        if is_new && guard.len() >= MAX_THEMES {
            return Err(AppError::validation("theme", "too many themes"));
        }
        let mut bytes = serde_json::to_vec_pretty(&theme).map_err(std::io::Error::other)?;
        bytes.push(b'\n');
        write_atomic(
            &self.paths.themes_dir().join(format!("{}.json", theme.id)),
            &bytes,
        )?;
        match guard.iter_mut().find(|t| t.id == theme.id) {
            Some(slot) => *slot = theme.clone(),
            None => {
                guard.push(theme.clone());
                guard.sort_by(|a, b| a.id.cmp(&b.id));
            }
        }
        Ok(theme)
    }

    /// Deletes a personal theme and its file.
    pub fn delete_theme(&self, id: &str) -> Result<(), AppError> {
        // `id` becomes part of a file name: only the strict id alphabet gets that far.
        super::validate::validate_id(id)
            .map_err(|_| AppError::validation("id", "invalid theme id"))?;
        let mut guard = lock(&self.themes);
        if !guard.iter().any(|t| t.id == id) {
            return Err(AppError::not_found(format!("theme «{id}»")));
        }
        match fs::remove_file(self.paths.themes_dir().join(format!("{id}.json"))) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
        guard.retain(|t| t.id != id);
        Ok(())
    }

    /// Imports a theme file as a new personal theme (a fresh `perso-` id, from its name).
    pub fn import_theme(&self, path: &Path) -> Result<ThemeFile, AppError> {
        let mut theme = read_import(path).map_err(|reason| {
            tracing::warn!(%reason, "theme file refused");
            AppError::validation("file", reason)
        })?;
        theme.id = self.new_theme_id(&theme.name);
        self.save_theme(theme)
    }

    /// Writes `<id>.json` in `dir` (never over an earlier export: `-2`, `-3`… is appended).
    pub fn export_theme(&self, id: &str, dir: &Path) -> Result<PathBuf, AppError> {
        let theme = lock(&self.themes)
            .iter()
            .find(|t| t.id == id)
            .cloned()
            .ok_or_else(|| AppError::not_found(format!("theme «{id}»")))?;
        let mut bytes = serde_json::to_vec_pretty(&theme).map_err(std::io::Error::other)?;
        bytes.push(b'\n');
        let mut path = dir.join(format!("{id}.json"));
        for n in 2u32.. {
            if !path.exists() {
                break;
            }
            path = dir.join(format!("{id}-{n}.json"));
        }
        write_atomic(&path, &bytes)?;
        Ok(path)
    }
}

#[cfg(test)]
#[path = "themes_tests.rs"]
mod tests;
