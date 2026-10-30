//! The user's ambiences (steps 16–17): `.hubmood` files imported by dropping them on Modifier ›
//! Apparence, kept in `moods/<id>.hubmood` with a fresh `perso-` id, deleted, exported. Strict like
//! themes: a file that does not fit the schema exactly is refused (moods.rs).

use std::fs;
use std::path::{Path, PathBuf};

use super::atomic::write_atomic;
use super::moods::MoodFile;
use super::schema::StrictFile;
use super::themes::{theme_id, PREFIX};
use super::{lock, ConfigState};
use crate::error::AppError;

/// At most this many imported ambiences.
pub const MAX_MOODS: usize = 40;
/// A dropped file is read only below this size.
const MAX_IMPORT_BYTES: u64 = 64 * 1024;
pub const EXTENSION: &str = "hubmood";

/// Reads a dropped file: its name and size are looked at before it is opened.
fn read_import(path: &Path) -> Result<MoodFile, String> {
    if !path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case(EXTENSION))
    {
        return Err("not a .hubmood file".into());
    }
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if !meta.is_file() || meta.len() > MAX_IMPORT_BYTES {
        return Err("not a regular file, or too large".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    // A BOM is tolerated (Notepad), nothing else.
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(&bytes);
    let mood: MoodFile = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    mood.check()?;
    Ok(mood)
}

fn to_bytes(mood: &MoodFile) -> Result<Vec<u8>, AppError> {
    let mut bytes = serde_json::to_vec_pretty(mood).map_err(std::io::Error::other)?;
    bytes.push(b'\n');
    Ok(bytes)
}

impl ConfigState {
    pub fn moods(&self) -> Vec<MoodFile> {
        lock(&self.moods).clone()
    }

    /// Imports a `.hubmood` file as a new ambience (a fresh `perso-` id, from its name).
    pub fn import_mood(&self, path: &Path) -> Result<MoodFile, AppError> {
        let mut mood = read_import(path).map_err(|reason| {
            tracing::warn!(%reason, "ambience file refused");
            AppError::validation("file", reason)
        })?;
        let mut guard = lock(&self.moods);
        if guard.len() >= MAX_MOODS {
            return Err(AppError::validation("file", "too many ambiences"));
        }
        mood.id = theme_id(&mood.name, |id| guard.iter().any(|m| m.id == id));
        write_atomic(
            &self
                .paths
                .moods_dir()
                .join(format!("{}.{EXTENSION}", mood.id)),
            &to_bytes(&mood)?,
        )?;
        guard.push(mood.clone());
        guard.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(mood)
    }

    /// Deletes an imported ambience and its file (apps that used it fall back to none).
    pub fn delete_mood(&self, id: &str) -> Result<(), AppError> {
        super::validate::validate_id(id)
            .map_err(|_| AppError::validation("id", "invalid ambience id"))?;
        if !id.starts_with(PREFIX) {
            return Err(AppError::validation(
                "id",
                "a built-in ambience cannot be deleted",
            ));
        }
        let mut guard = lock(&self.moods);
        if !guard.iter().any(|m| m.id == id) {
            return Err(AppError::not_found(format!("ambience «{id}»")));
        }
        let file = self.paths.moods_dir().join(format!("{id}.{EXTENSION}"));
        match fs::remove_file(file) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
        guard.retain(|m| m.id != id);
        Ok(())
    }
}

/// Writes `<id>.hubmood` in `dir` (never over an earlier export: `-2`, `-3`… is appended). The page
/// sends the ambience (a built-in pack lives in the page): it is checked like an imported one.
pub fn export_mood(mood: &MoodFile, dir: &Path) -> Result<PathBuf, AppError> {
    mood.check()
        .map_err(|message| AppError::validation("mood", message))?;
    let mut path = dir.join(format!("{}.{EXTENSION}", mood.id));
    for n in 2u32.. {
        if !path.exists() {
            break;
        }
        path = dir.join(format!("{}-{n}.{EXTENSION}", mood.id));
    }
    write_atomic(&path, &to_bytes(mood)?)?;
    Ok(path)
}
