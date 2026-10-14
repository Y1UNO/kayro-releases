//! Images the user gave an app (dropped on its card): copied into `art/<appId>/<role>.<ext>`, so
//! moving or deleting the original never breaks the card. They win over Steam's.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use super::{sniff, ArtOrigin, ArtRole, Found, MAX_BYTES};
use crate::config::validate::validate_id;

/// Extensions accepted, also the names looked for (`poster.jpg`, `poster.png`…).
pub const EXTENSIONS: [&str; 4] = ["jpg", "jpeg", "png", "webp"];

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum UserArtError {
    #[error("invalid app id")]
    BadId,
    #[error("this image cannot be chosen by the user")]
    NotSettable,
    #[error("not a file, or unreadable")]
    Unreadable,
    #[error("larger than 16 MB")]
    TooLarge,
    #[error("not a JPEG, PNG or WebP image")]
    NotAnImage,
    #[error("could not save the copy: {0}")]
    Write(String),
}

fn folder(root: &Path, app_id: &str) -> Option<PathBuf> {
    validate_id(app_id).ok().map(|()| root.join(app_id))
}

/// The user's image for `role`, if any.
pub fn find(root: &Path, app_id: &str, role: ArtRole) -> Option<Found> {
    if !role.user_settable() {
        return None;
    }
    let dir = folder(root, app_id)?;
    EXTENSIONS
        .iter()
        .map(|ext| dir.join(format!("{}.{ext}", role.slug())))
        .find(|p| p.is_file())
        .map(|path| Found {
            path,
            origin: ArtOrigin::User,
            low_res: false,
        })
}

/// Copies `source` as the app's image for `role`, replacing the previous one. The file is checked
/// by its bytes (never by its extension) and is never opened by anything else than this copy.
pub fn set(root: &Path, app_id: &str, role: ArtRole, source: &Path) -> Result<(), UserArtError> {
    let dir = folder(root, app_id).ok_or(UserArtError::BadId)?;
    if !role.user_settable() {
        return Err(UserArtError::NotSettable);
    }
    let meta = fs::metadata(source)
        .ok()
        .filter(fs::Metadata::is_file)
        .ok_or(UserArtError::Unreadable)?;
    if meta.len() > MAX_BYTES {
        return Err(UserArtError::TooLarge);
    }
    let bytes = fs::read(source).map_err(|_| UserArtError::Unreadable)?;
    let (_, ext) = sniff(&bytes).ok_or(UserArtError::NotAnImage)?;
    clear(root, app_id, role).map_err(|e| UserArtError::Write(e.to_string()))?;
    fs::create_dir_all(&dir)
        .and_then(|()| {
            crate::config::atomic::write_atomic(&dir.join(format!("{}.{ext}", role.slug())), &bytes)
        })
        .map_err(|e| UserArtError::Write(e.to_string()))
}

/// Removes the user's image for `role` (Steam's comes back, if there is one).
pub fn clear(root: &Path, app_id: &str, role: ArtRole) -> io::Result<()> {
    let Some(dir) = folder(root, app_id) else {
        return Ok(());
    };
    for ext in EXTENSIONS {
        match fs::remove_file(dir.join(format!("{}.{ext}", role.slug()))) {
            Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e),
            _ => {}
        }
    }
    Ok(())
}
