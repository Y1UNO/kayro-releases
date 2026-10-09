//! Runs every source in parallel on its own thread, never on the UI thread. One source failing
//! (error or panic) is reported for that source only; the others still deliver.

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Mutex;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

use super::category::suggest_category;
use super::{CancelToken, DetectSource, DetectedApp, ScanCtx, SourceKind};
use crate::config::apps::AppEntry;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ScanState {
    Started,
    Done,
    Failed,
    Cancelled,
}

/// Emitted while a scan runs, once per source and state change.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct DetectProgress {
    pub source: SourceKind,
    pub state: ScanState,
    /// Apps found so far by this source (0 until it is done).
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SourceReport {
    pub source: SourceKind,
    pub apps: Vec<DetectedApp>,
    /// Entries looked at and left out (tools, uninstallers, unreadable files…).
    pub skipped: u32,
    pub error: Option<String>,
    pub ms: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    pub sources: Vec<SourceReport>,
    pub total_ms: u32,
    pub cancelled: bool,
}

fn millis(since: Instant) -> u32 {
    u32::try_from(since.elapsed().as_millis()).unwrap_or(u32::MAX)
}

fn run_one(
    source: &dyn DetectSource,
    existing: &[AppEntry],
    cancel: &CancelToken,
    on_progress: &(dyn Fn(DetectProgress) + Sync),
) -> SourceReport {
    let kind = source.kind();
    let started = Instant::now();
    on_progress(DetectProgress {
        source: kind,
        state: ScanState::Started,
        count: 0,
    });
    let ctx = ScanCtx::new(cancel.clone());
    let outcome = catch_unwind(AssertUnwindSafe(|| source.scan(&ctx)))
        .unwrap_or_else(|_| Err(super::DetectError("the scan crashed".into())));
    let (apps, error) = match outcome {
        Ok(mut apps) => {
            for app in &mut apps {
                app.already_added = existing.iter().any(|e| app.matches_entry(e));
                app.suggested_category =
                    suggest_category(&app.name, app.match_rule.exe.as_deref(), Some(kind)).into();
            }
            (apps, None)
        }
        Err(e) => {
            tracing::warn!(source = ?kind, error = %e, "detect: source failed");
            (Vec::new(), Some(e.to_string()))
        }
    };
    let state = if error.is_some() {
        ScanState::Failed
    } else if cancel.is_cancelled() {
        ScanState::Cancelled
    } else {
        ScanState::Done
    };
    on_progress(DetectProgress {
        source: kind,
        state,
        count: u32::try_from(apps.len()).unwrap_or(u32::MAX),
    });
    let report = SourceReport {
        source: kind,
        apps,
        skipped: ctx.skipped(),
        error,
        ms: millis(started),
    };
    tracing::info!(source = ?kind, found = report.apps.len(), skipped = report.skipped, ms = report.ms, "detect: source done");
    report
}

/// Scans all sources at once. `existing` marks apps the user already has.
pub fn run_scan(
    sources: &[Box<dyn DetectSource>],
    existing: &[AppEntry],
    cancel: &CancelToken,
    on_progress: &(dyn Fn(DetectProgress) + Sync),
) -> ScanReport {
    let started = Instant::now();
    let reports = std::thread::scope(|scope| {
        let handles: Vec<_> = sources
            .iter()
            .map(|s| scope.spawn(move || run_one(s.as_ref(), existing, cancel, on_progress)))
            .collect();
        handles
            .into_iter()
            .zip(sources)
            .map(|(h, s)| {
                h.join().unwrap_or_else(|_| SourceReport {
                    source: s.kind(),
                    apps: Vec::new(),
                    skipped: 0,
                    error: Some("the scan crashed".into()),
                    ms: millis(started),
                })
            })
            .collect()
    });
    ScanReport {
        sources: reports,
        total_ms: millis(started),
        cancelled: cancel.is_cancelled(),
    }
}

/// The scan in progress, if any: starting a new one cancels the previous.
#[derive(Default)]
pub struct DetectState {
    current: Mutex<Option<CancelToken>>,
}

impl DetectState {
    pub fn begin(&self) -> CancelToken {
        let token = CancelToken::default();
        let mut slot = self.current.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(previous) = slot.replace(token.clone()) {
            previous.cancel();
        }
        token
    }

    pub fn cancel(&self) {
        let slot = self.current.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(token) = slot.as_ref() {
            token.cancel();
        }
    }

    /// Forgets `token` if it is still the current scan.
    pub fn finish(&self, token: &CancelToken) {
        let mut slot = self.current.lock().unwrap_or_else(|p| p.into_inner());
        if slot.as_ref().is_some_and(|t| t.same_as(token)) {
            *slot = None;
        }
    }
}

#[cfg(test)]
#[path = "scan_tests.rs"]
mod tests;
