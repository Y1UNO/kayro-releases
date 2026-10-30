//! Local art of the apps (step 14): posters, heroes, logos and small icons, read **in place** from
//! the user's own images (`art/<appId>/`, copies of files the user dropped) or from the Steam
//! client's cache (`appcache/librarycache`). Nothing is downloaded, nothing is copied from Steam,
//! nothing ever goes into the installer or an export. The page never names a file: it asks for an
//! app id and a role through the `kayro-art` protocol, and the core finds the file.
//!
//! Roles are an open list: the special cards of steps 16–17 (layered characters, background) add
//! roles here and in `user.rs` without touching the protocol or the index.

pub mod locate;
pub mod palette;
pub mod palettes;
pub mod protocol;
pub mod user;

use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::config::apps::{AppEntry, AppSource};

/// What an image is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ArtRole {
    /// Vertical poster (cards).
    Poster,
    /// Wide hero picture (background of the immersive mode, later).
    Hero,
    /// The hero already blurred by Steam.
    HeroBlur,
    /// Transparent title logo.
    Logo,
    /// Small square icon (Steam's 32 px one): for apps the Shell gives no icon for.
    Icon,
    /// Special card (steps 16–17): a cut-out character, transparent PNG, left of the active card.
    CharLeft,
    /// The same, right of the active card.
    CharRight,
}

impl ArtRole {
    pub const ALL: [ArtRole; 7] = [
        ArtRole::Poster,
        ArtRole::Hero,
        ArtRole::HeroBlur,
        ArtRole::Logo,
        ArtRole::Icon,
        ArtRole::CharLeft,
        ArtRole::CharRight,
    ];

    /// Name used in URLs and in the user's file names (`art/<appId>/<slug>.<ext>`).
    pub fn slug(self) -> &'static str {
        match self {
            ArtRole::Poster => "poster",
            ArtRole::Hero => "hero",
            ArtRole::HeroBlur => "hero-blur",
            ArtRole::Logo => "logo",
            ArtRole::Icon => "icon",
            ArtRole::CharLeft => "char-left",
            ArtRole::CharRight => "char-right",
        }
    }

    pub fn from_slug(slug: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|r| r.slug() == slug)
    }

    /// Roles the user can provide an image for (the blurred hero and the icon come from Steam;
    /// the special card's characters only from the user).
    pub fn user_settable(self) -> bool {
        matches!(
            self,
            ArtRole::Poster
                | ArtRole::Hero
                | ArtRole::Logo
                | ArtRole::CharLeft
                | ArtRole::CharRight
        )
    }
}

/// Where an image comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ArtOrigin {
    User,
    Steam,
}

/// An image found on disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Found {
    pub path: PathBuf,
    pub origin: ArtOrigin,
    /// Steam's 300 × 450 capsule instead of the 600 × 900 poster.
    pub low_res: bool,
}

/// One image of an app, as the interface sees it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ArtImage {
    pub role: ArtRole,
    pub origin: ArtOrigin,
    /// Size and modification time of the file: changes when the image changes (URL `?v=`).
    pub stamp: String,
    pub low_res: bool,
}

/// The images of one app (apps without any are left out of the index).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppArt {
    pub id: String,
    pub images: Vec<ArtImage>,
}

/// The only two places images are read from.
#[derive(Debug, Clone)]
pub struct ArtRoots {
    /// `%APPDATA%/Kayro/art`.
    pub user: PathBuf,
    /// `<Steam>/appcache/librarycache`, when Steam is installed.
    pub steam_cache: Option<PathBuf>,
}

impl ArtRoots {
    /// Found once at start-up (the Steam folder does not move while Kayro runs).
    pub fn system(user: PathBuf) -> Self {
        let steam_cache = crate::detect::steam::find_root()
            .map(|root| root.join("appcache").join("librarycache"))
            .filter(|p| p.is_dir());
        Self { user, steam_cache }
    }
}

/// The image of `app` for `role`: the user's own first, then Steam's.
pub fn find(roots: &ArtRoots, app: &AppEntry, role: ArtRole) -> Option<Found> {
    user::find(&roots.user, &app.id, role).or_else(|| match (&app.source, &roots.steam_cache) {
        (AppSource::Steam { app_id }, Some(cache)) => locate::steam(cache, app_id, role),
        _ => None,
    })
}

/// Every image of every app, without reading a single image (only folder listings).
pub fn index(roots: &ArtRoots, apps: &[AppEntry]) -> Vec<AppArt> {
    apps.iter()
        .filter_map(|app| {
            let images: Vec<ArtImage> = ArtRole::ALL
                .into_iter()
                .filter_map(|role| {
                    let found = find(roots, app, role)?;
                    Some(ArtImage {
                        role,
                        origin: found.origin,
                        stamp: stamp(&found.path)?,
                        low_res: found.low_res,
                    })
                })
                .collect();
            (!images.is_empty()).then(|| AppArt {
                id: app.id.clone(),
                images,
            })
        })
        .collect()
}

/// `<size>-<mtime>` in hexadecimal; `None` when the file cannot be read.
pub fn stamp(path: &Path) -> Option<String> {
    let meta = std::fs::metadata(path).ok()?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis());
    Some(format!("{:x}-{:x}", meta.len(), mtime))
}

/// Kind of image, recognised from its first bytes (the extension is never trusted).
pub fn sniff(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(("image/jpeg", "jpg"))
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some(("image/png", "png"))
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("image/webp", "webp"))
    } else {
        None
    }
}

/// Largest image read or accepted (Steam's heroes are under 1 MB).
pub const MAX_BYTES: u64 = 16 * 1024 * 1024;

/// Index of the art, kept by the app.
pub struct ArtState {
    pub roots: ArtRoots,
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
