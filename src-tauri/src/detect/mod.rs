//! Detection of installed applications. Read-only: a scan only *proposes* apps, nothing is
//! written to the configuration (adding is the user's decision, step 9).
//!
//! One module per source behind the [`DetectSource`] trait. Every source is tolerant: an entry
//! that cannot be understood is skipped and logged, never an error for the whole scan.

pub mod epic;
pub mod filters;
pub mod scan;
pub mod startmenu;
pub mod steam;

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::config::apps::{AppEntry, AppSource, Art, Launch, MatchRule, NewApp};
use crate::config::validate::validate_new_app;

/// Where a detected app comes from (also the identity of a [`DetectSource`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Steam,
    Epic,
    Startmenu,
}

impl SourceKind {
    /// Category proposed when the app is added.
    pub fn default_category(self) -> &'static str {
        match self {
            SourceKind::Steam | SourceKind::Epic => "jeux",
            SourceKind::Startmenu => "autres",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DetectedApp {
    /// Stable between scans, valid as an app id (`steam-<appid>`, `epic-<name>`, `menu-<hash>`).
    pub id: String,
    pub name: String,
    pub source: AppSource,
    pub launch: Launch,
    #[serde(rename = "match")]
    pub match_rule: MatchRule,
    /// Absolute path of an image found in the launcher's own cache. Never copied here: the
    /// resized image cache belongs to a later step.
    pub poster_path: Option<String>,
    pub hero_path: Option<String>,
    pub already_added: bool,
}

impl DetectedApp {
    /// The value `apps_add` would receive (art is left empty: see `poster_path`).
    pub fn to_new_app(&self, kind: SourceKind) -> NewApp {
        NewApp {
            name: self.name.clone(),
            category: kind.default_category().into(),
            source: self.source.clone(),
            launch: self.launch.clone(),
            match_rule: self.match_rule.clone(),
            art: Art::default(),
            mood_id: None,
            favorite: false,
        }
    }

    /// Is this the same app as an entry already in `apps.json`?
    pub fn matches_entry(&self, entry: &AppEntry) -> bool {
        match (&self.source, &entry.source) {
            (AppSource::Steam { app_id: a }, AppSource::Steam { app_id: b }) => a == b,
            (AppSource::Epic { app_name: a }, AppSource::Epic { app_name: b }) => a == b,
            _ => match (&self.launch, &entry.launch) {
                (Launch::Lnk { path: a }, Launch::Lnk { path: b }) => a.eq_ignore_ascii_case(b),
                (Launch::Uri { uri: a }, Launch::Uri { uri: b }) => a == b,
                _ => false,
            },
        }
    }
}

/// Shared flag to stop a running scan (checked between entries, never mid-file).
#[derive(Debug, Clone, Default)]
pub struct CancelToken(Arc<AtomicBool>);

impl CancelToken {
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Relaxed);
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }

    pub fn same_as(&self, other: &CancelToken) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}

/// What a source needs while scanning: cancellation, and one place to report skipped entries.
#[derive(Debug, Default)]
pub struct ScanCtx {
    pub cancel: CancelToken,
    skipped: AtomicU32,
}

impl ScanCtx {
    pub fn new(cancel: CancelToken) -> Self {
        Self {
            cancel,
            skipped: AtomicU32::new(0),
        }
    }

    pub fn cancelled(&self) -> bool {
        self.cancel.is_cancelled()
    }

    pub fn skipped(&self) -> u32 {
        self.skipped.load(Ordering::Relaxed)
    }

    /// An entry that was ignored on purpose or because it could not be read.
    pub fn skip(&self, what: &str, why: &str) {
        self.skipped.fetch_add(1, Ordering::Relaxed);
        tracing::debug!(entry = what, reason = why, "detect: entry skipped");
    }

    /// Keeps `app` only if it would pass the same validation as `apps_add`.
    pub fn accept(&self, kind: SourceKind, app: DetectedApp) -> Option<DetectedApp> {
        match validate_new_app(&app.to_new_app(kind)) {
            Ok(()) => Some(app),
            Err(e) => {
                self.skip(&app.id, &e.to_string());
                None
            }
        }
    }
}

#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct DetectError(pub String);

impl From<std::io::Error> for DetectError {
    fn from(e: std::io::Error) -> Self {
        Self(e.to_string())
    }
}

pub trait DetectSource: Send + Sync {
    fn kind(&self) -> SourceKind;
    /// Not finding the launcher at all is `Ok(vec![])`, not an error.
    fn scan(&self, ctx: &ScanCtx) -> Result<Vec<DetectedApp>, DetectError>;
}

/// Source list for the real machine.
pub fn default_sources() -> Vec<Box<dyn DetectSource>> {
    vec![
        Box::new(steam::SteamSource::system()),
        Box::new(epic::EpicSource::system()),
        Box::new(startmenu::StartMenuSource::system()),
    ]
}

/// 64-bit FNV-1a: tiny, deterministic, enough to derive stable ids (not a security hash).
pub(crate) fn fnv1a(text: &str) -> u64 {
    text.bytes().fold(0xcbf2_9ce4_8422_2325, |h, b| {
        (h ^ u64::from(b)).wrapping_mul(0x0100_0000_01b3)
    })
}

/// 12 hex characters derived from `text`.
pub(crate) fn short_hash(text: &str) -> String {
    format!("{:012x}", fnv1a(text) & 0xffff_ffff_ffff)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_hash_is_stable_and_id_safe() {
        assert_eq!(short_hash("a"), short_hash("a"));
        assert_ne!(short_hash("a"), short_hash("b"));
        assert!(crate::config::validate::validate_id(&format!("menu-{}", short_hash("x"))).is_ok());
    }

    #[test]
    fn cancel_token_is_shared_between_clones() {
        let a = CancelToken::default();
        let b = a.clone();
        assert!(!b.is_cancelled());
        a.cancel();
        assert!(b.is_cancelled() && a.same_as(&b));
    }
}
