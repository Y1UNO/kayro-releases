//! Load / save of one versioned JSON document. Never panics and never gives up: whatever
//! is on disk, `load` returns a usable value (defaults at worst) and a report of what it did.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

use super::atomic::{sibling, tmp_path, write_atomic};
use super::migrate::{current_version, migrate, Migration};

/// Max entries kept in a `.rejected` side file (oldest dropped first).
const MAX_REJECTED: usize = 200;

/// An entry of a list that was set aside because it was invalid.
#[derive(Debug, Clone)]
pub struct Rejected {
    pub reason: String,
    pub entry: Value,
}

/// What `load` had to do besides reading the file.
#[derive(Debug, Default)]
pub struct LoadReport {
    pub migrated_from: Option<u32>,
    /// Where the unreadable file was moved (`<file>.corrupt[.N]`).
    pub quarantined: Option<PathBuf>,
    pub rejected: Vec<Rejected>,
    pub warnings: Vec<String>,
}

impl LoadReport {
    pub fn warn(&mut self, message: String) {
        tracing::warn!("{message}");
        self.warnings.push(message);
    }

    pub fn is_clean(&self) -> bool {
        self.migrated_from.is_none()
            && self.quarantined.is_none()
            && self.rejected.is_empty()
            && self.warnings.is_empty()
    }
}

/// A user-owned file. `from_value` builds the typed document from migrated JSON and decides how
/// forgiving to be (unknown fields ignored, invalid list entries set aside…). It returns `Err`
/// only when the whole file is unusable, which sends it to quarantine.
pub trait Document: Serialize + Default {
    const NAME: &'static str;
    const MIGRATIONS: &'static [Migration] = &[];
    fn from_value(value: Value, report: &mut LoadReport) -> Result<Self, String>;
}

pub fn save<D: Document>(path: &Path, doc: &D) -> io::Result<()> {
    let mut bytes = serde_json::to_vec_pretty(doc).map_err(io::Error::other)?;
    bytes.push(b'\n');
    write_atomic(path, &bytes)
}

pub fn load<D: Document>(path: &Path) -> (D, LoadReport) {
    let mut report = LoadReport::default();
    let _ = fs::remove_file(tmp_path(path)); // leftover of an interrupted write
    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return (D::default(), report),
        Err(e) => {
            report.warn(format!("{}: unreadable ({e}), using defaults", D::NAME));
            return (D::default(), report);
        }
    };
    match build::<D>(&bytes, path, &mut report) {
        Ok(doc) => {
            if !report.rejected.is_empty() {
                append_rejected(path, &report.rejected);
            }
            if report.migrated_from.is_some() || !report.rejected.is_empty() {
                if let Err(e) = save(path, &doc) {
                    report.warn(format!("{}: could not rewrite after load: {e}", D::NAME));
                }
            }
            (doc, report)
        }
        Err(reason) => {
            quarantine(path, &reason, &mut report);
            (D::default(), report)
        }
    }
}

fn build<D: Document>(bytes: &[u8], path: &Path, report: &mut LoadReport) -> Result<D, String> {
    // Windows editors may save with a UTF-8 byte-order mark; JSON parsers refuse it.
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    let value: Value = serde_json::from_slice(bytes).map_err(|e| format!("invalid JSON: {e}"))?;
    let version = value
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .and_then(|v| u32::try_from(v).ok())
        .ok_or("missing or invalid schemaVersion (or root is not an object)")?;
    let current = current_version(D::MIGRATIONS);
    let value = if version < current {
        fs::copy(path, sibling(path, ".bak")).map_err(|e| format!("cannot write .bak: {e}"))?;
        report.migrated_from = Some(version);
        migrate(value, version, D::MIGRATIONS)?
    } else if version > current {
        return Err(format!(
            "written by a newer version (schemaVersion {version} > {current})"
        ));
    } else {
        value
    };
    D::from_value(value, report)
}

/// Moves an unreadable file aside so nothing is lost and the next save starts clean.
fn quarantine(path: &Path, reason: &str, report: &mut LoadReport) {
    let mut dest = sibling(path, ".corrupt");
    let mut n = 0u32;
    while dest.exists() {
        n += 1;
        dest = sibling(path, &format!(".corrupt.{n}"));
    }
    match fs::rename(path, &dest) {
        Ok(()) => {
            report.warn(format!(
                "{}: {reason}; moved to {}",
                path.display(),
                dest.display()
            ));
            report.quarantined = Some(dest);
        }
        Err(e) => report.warn(format!(
            "{}: {reason}; could not move it aside: {e}",
            path.display()
        )),
    }
}

fn append_rejected(path: &Path, rejected: &[Rejected]) {
    let side = sibling(path, ".rejected");
    let mut all: Vec<Value> = fs::read(&side)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();
    let at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    for r in rejected {
        tracing::warn!(file = %path.display(), reason = %r.reason, "entry set aside");
        all.push(serde_json::json!({ "rejectedAt": at, "reason": r.reason, "entry": r.entry }));
    }
    if all.len() > MAX_REJECTED {
        all.drain(..all.len() - MAX_REJECTED);
    }
    let written = serde_json::to_vec_pretty(&all)
        .map_err(io::Error::other)
        .and_then(|b| write_atomic(&side, &b));
    if let Err(e) = written {
        tracing::warn!(error = %e, "could not write the .rejected file");
    }
}

/// Tolerant typed read of a flat object: starts from `T::default()` and applies the file's
/// fields one at a time. An unknown field is ignored (warning); a field whose value does not
/// fit the type, or fails `accept`, keeps its default (warning). Nothing else is affected.
pub fn lenient_merge<T: Default + Serialize + DeserializeOwned>(
    value: Value,
    report: &mut LoadReport,
    accept: impl Fn(&T) -> Result<(), String>,
) -> T {
    let Value::Object(file) = value else {
        return T::default();
    };
    let Ok(Value::Object(mut merged)) = serde_json::to_value(T::default()) else {
        return T::default();
    };
    let mut doc = T::default();
    for (key, val) in file {
        if key == "schemaVersion" {
            continue;
        }
        if !merged.contains_key(&key) {
            report.warn(format!("unknown field «{key}» ignored"));
            continue;
        }
        let previous = merged.insert(key.clone(), val);
        let attempt = serde_json::from_value::<T>(Value::Object(merged.clone()))
            .map_err(|e| e.to_string())
            .and_then(|t| accept(&t).map(|()| t));
        match attempt {
            Ok(t) => doc = t,
            Err(e) => {
                report.warn(format!(
                    "invalid field «{key}» replaced by its default: {e}"
                ));
                if let Some(p) = previous {
                    merged.insert(key, p);
                }
            }
        }
    }
    doc
}
