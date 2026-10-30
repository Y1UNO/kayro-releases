//! After the sources (step 19b): an app seen by two sources is proposed once, stores and launchers
//! are set apart, and what the user chose to ignore is marked. Pure functions on the reports.

use std::collections::HashSet;

use super::category::{is_launcher, normalise};
use super::scan::{ScanReport, SourceReport};
use super::SourceKind;

/// Sets stores and launchers apart (Steam, Riot Client, Battle.net…).
pub fn mark_launchers(reports: &mut [SourceReport]) {
    for app in reports.iter_mut().flat_map(|r| r.apps.iter_mut()) {
        app.launcher = is_launcher(&app.name);
    }
}

/// A Start Menu shortcut with the name of a Steam or Epic game is that game: the store's entry is
/// kept (it brings the images and the launch through the store). When the shortcut was the one
/// added, the store's entry counts as added too.
pub fn merge_twins(reports: &mut [SourceReport]) {
    let is_store = |k: SourceKind| matches!(k, SourceKind::Steam | SourceKind::Epic);
    let stores: HashSet<String> = reports
        .iter()
        .filter(|r| is_store(r.source))
        .flat_map(|r| r.apps.iter().map(|a| normalise(&a.name)))
        .collect();
    if stores.is_empty() {
        return;
    }
    let mut added_twins = HashSet::new();
    for report in reports.iter_mut().filter(|r| r.source == SourceKind::Startmenu) {
        report.apps.retain(|a| {
            let key = normalise(&a.name);
            if !stores.contains(&key) {
                return true;
            }
            if a.already_added {
                added_twins.insert(key);
            }
            false
        });
    }
    for report in reports.iter_mut().filter(|r| is_store(r.source)) {
        for app in &mut report.apps {
            if added_twins.contains(&normalise(&app.name)) {
                app.already_added = true;
            }
        }
    }
}

/// Marks the apps the user chose to ignore (their ids, `Settings::ignored_detections`).
pub fn mark_ignored(report: &mut ScanReport, ignored: &[String]) {
    let ignored: HashSet<&str> = ignored.iter().map(String::as_str).collect();
    for app in report.sources.iter_mut().flat_map(|r| r.apps.iter_mut()) {
        app.ignored = ignored.contains(app.id.as_str());
    }
}

#[cfg(test)]
#[path = "tidy_tests.rs"]
mod tests;
