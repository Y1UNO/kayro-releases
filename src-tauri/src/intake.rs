//! Turns what the user drops or pastes (program files, shortcuts, web addresses) into app
//! candidates. Read-only: nothing is started, nothing is written. The interface shows the
//! candidates, the user confirms, and `apps_add_many` validates again.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;

use crate::config::apps::{AppEntry, Launch, MatchRule, NewApp};
use crate::config::validate::validate_new_app;
use crate::detect::category::suggest_category;

/// More than this in one drop is refused (a folder dragged by mistake, a select-all…).
pub const MAX_INPUTS: usize = 50;

/// An app the user could add.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    /// What the user gave (path or address), to tell candidates apart in the interface.
    pub input: String,
    pub name: String,
    pub launch: Launch,
    #[serde(rename = "match")]
    pub match_rule: MatchRule,
    pub suggested_category: String,
    /// Already in the list: shown, but not added again.
    pub already_added: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RejectReason {
    /// The file is not there (anymore).
    NotFound,
    /// A folder, a document, a protocol the hub does not start…
    NotSupported,
    /// Refused by the same validation as `apps_add` (too long, odd characters…).
    Invalid,
    /// Given twice in the same drop.
    Repeated,
    /// Beyond [`MAX_INPUTS`].
    TooMany,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Refused {
    pub input: String,
    pub reason: RejectReason,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InspectReport {
    pub candidates: Vec<Candidate>,
    pub refused: Vec<Refused>,
}

fn refuse(report: &mut InspectReport, input: &str, reason: RejectReason) {
    report.refused.push(Refused {
        input: input.to_string(),
        reason,
    });
}

/// Explorer wraps paths with spaces in quotes when pasting; users add stray spaces too.
fn clean(input: &str) -> &str {
    input.trim().trim_matches('"').trim()
}

fn is_web(input: &str) -> bool {
    let lower = input.to_ascii_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

/// `https://www.youtube.com/watch?v=1` → `youtube.com`
fn site_name(url: &str) -> String {
    let rest = url.split_once("://").map_or(url, |(_, r)| r);
    let host = rest.split(['/', '?', '#']).next().unwrap_or(rest);
    let host = host.rsplit('@').next().unwrap_or(host);
    let host = host.split(':').next().unwrap_or(host);
    host.strip_prefix("www.").unwrap_or(host).to_string()
}

fn stem(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().trim().to_string())
        .unwrap_or_default()
}

fn extension(path: &Path) -> String {
    path.extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

fn file_name(path: &Path) -> Option<String> {
    path.file_name().map(|f| f.to_string_lossy().into_owned())
}

/// Builds the candidate for one input, or says why not.
fn candidate_for(
    input: &str,
    resolve_lnk: &dyn Fn(&Path) -> Option<PathBuf>,
) -> Result<(String, Launch, MatchRule), RejectReason> {
    if is_web(input) {
        let url = input.to_string();
        return Ok((site_name(&url), Launch::Url { url }, MatchRule::default()));
    }
    let path = Path::new(input);
    if !path.is_absolute() {
        return Err(RejectReason::NotSupported);
    }
    if !path.exists() {
        return Err(RejectReason::NotFound);
    }
    if !path.is_file() {
        return Err(RejectReason::NotSupported);
    }
    let text = path.to_string_lossy().into_owned();
    match extension(path).as_str() {
        "exe" => Ok((
            stem(path),
            Launch::Exe {
                path: text,
                args: Vec::new(),
                cwd: None,
                elevated: false,
            },
            MatchRule {
                exe: file_name(path),
            },
        )),
        "lnk" => {
            // The target tells which process to follow; unreadable shortcuts still work.
            let exe = resolve_lnk(path)
                .filter(|t| extension(t) == "exe")
                .and_then(|t| file_name(&t));
            Ok((stem(path), Launch::Lnk { path: text }, MatchRule { exe }))
        }
        _ => Err(RejectReason::NotSupported),
    }
}

/// Looks at what was dropped or pasted. `existing` marks apps that are already in the list;
/// `resolve_lnk` reads the target of a shortcut (injected so tests need no COM).
pub fn inspect(
    inputs: &[String],
    existing: &[AppEntry],
    resolve_lnk: &dyn Fn(&Path) -> Option<PathBuf>,
) -> InspectReport {
    let mut report = InspectReport::default();
    let mut seen = HashSet::new();
    for (i, raw) in inputs.iter().enumerate() {
        let input = clean(raw);
        if input.is_empty() {
            continue;
        }
        if i >= MAX_INPUTS {
            refuse(&mut report, input, RejectReason::TooMany);
            continue;
        }
        let (name, launch, match_rule) = match candidate_for(input, resolve_lnk) {
            Ok(found) => found,
            Err(reason) => {
                refuse(&mut report, input, reason);
                continue;
            }
        };
        let suggested = suggest_category(&name, match_rule.exe.as_deref(), None);
        let probe = NewApp {
            name: name.clone(),
            category: suggested.into(),
            source: crate::config::apps::AppSource::Manual,
            launch: launch.clone(),
            match_rule: match_rule.clone(),
            art: Default::default(),
            mood_id: None,
            favorite: false,
        };
        if validate_new_app(&probe).is_err() {
            refuse(&mut report, input, RejectReason::Invalid);
            continue;
        }
        let key = launch.target_key();
        if !seen.insert(key.clone()) {
            refuse(&mut report, input, RejectReason::Repeated);
            continue;
        }
        report.candidates.push(Candidate {
            input: input.to_string(),
            name,
            already_added: existing.iter().any(|e| e.launch.target_key() == key),
            launch,
            match_rule,
            suggested_category: suggested.into(),
        });
    }
    report
}

/// Target of a `.lnk` file, read through the Shell (needs COM on the calling thread).
pub fn shortcut_target(link: &Path) -> Option<PathBuf> {
    let _com = crate::platform::com::ComGuard::init();
    crate::detect::startmenu::resolve(link)
        .ok()
        .map(|s| s.target)
        .filter(|t| !t.as_os_str().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::apps::{AppSource, Art};
    use std::fs;

    fn none(_: &Path) -> Option<PathBuf> {
        None
    }

    fn inputs(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    fn existing(path: &str) -> AppEntry {
        AppEntry {
            id: "x".into(),
            name: "X".into(),
            category: "autres".into(),
            source: AppSource::Manual,
            launch: Launch::Exe {
                path: path.into(),
                args: vec![],
                cwd: None,
                elevated: false,
            },
            match_rule: MatchRule::default(),
            art: Art::default(),
            mood_id: None,
            favorite: false,
            colors: None,
        }
    }

    #[test]
    fn an_exe_becomes_a_candidate_named_after_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let exe = dir.path().join("Cool Game.exe");
        fs::write(&exe, b"MZ").unwrap();
        let report = inspect(&inputs(&[&exe.to_string_lossy()]), &[], &none);
        assert!(report.refused.is_empty());
        let c = &report.candidates[0];
        assert_eq!(c.name, "Cool Game");
        assert_eq!(c.match_rule.exe.as_deref(), Some("Cool Game.exe"));
        assert!(!c.already_added);
        assert!(matches!(
            c.launch,
            Launch::Exe {
                elevated: false,
                ..
            }
        ));
    }

    #[test]
    fn a_shortcut_follows_the_process_of_its_target() {
        let dir = tempfile::tempdir().unwrap();
        let lnk = dir.path().join("Editor.lnk");
        fs::write(&lnk, b"L").unwrap();
        let resolver = |_: &Path| Some(PathBuf::from(r"C:\Tools\editor64.exe"));
        let report = inspect(&inputs(&[&lnk.to_string_lossy()]), &[], &resolver);
        let c = &report.candidates[0];
        assert!(matches!(c.launch, Launch::Lnk { .. }));
        assert_eq!(c.match_rule.exe.as_deref(), Some("editor64.exe"));
        // A target that is not a program gives no process to follow.
        let doc = |_: &Path| Some(PathBuf::from(r"C:\Docs\readme.txt"));
        let report = inspect(&inputs(&[&lnk.to_string_lossy()]), &[], &doc);
        assert_eq!(report.candidates[0].match_rule.exe, None);
    }

    #[test]
    fn web_addresses_are_named_after_the_site() {
        let report = inspect(
            &inputs(&[
                "  https://www.youtube.com/watch?v=1 ",
                "http://localhost:8080/a",
            ]),
            &[],
            &none,
        );
        assert_eq!(report.candidates[0].name, "youtube.com");
        assert_eq!(report.candidates[1].name, "localhost");
        assert!(matches!(report.candidates[0].launch, Launch::Url { .. }));
    }

    #[test]
    fn quotes_around_a_pasted_path_are_removed() {
        let dir = tempfile::tempdir().unwrap();
        let exe = dir.path().join("a.exe");
        fs::write(&exe, b"MZ").unwrap();
        let quoted = format!("\"{}\"", exe.display());
        assert_eq!(inspect(&inputs(&[&quoted]), &[], &none).candidates.len(), 1);
    }

    #[test]
    fn unsupported_missing_and_repeated_inputs_are_refused_with_a_reason() {
        let dir = tempfile::tempdir().unwrap();
        let doc = dir.path().join("notes.txt");
        fs::write(&doc, b"x").unwrap();
        let exe = dir.path().join("b.exe");
        fs::write(&exe, b"MZ").unwrap();
        let (doc, exe) = (doc.to_string_lossy(), exe.to_string_lossy());
        let folder = dir.path().to_string_lossy();
        let report = inspect(
            &inputs(&[
                &doc,
                &folder,
                r"C:\definitely\missing.exe",
                "relative.exe",
                "ftp://example.com/x",
                &exe,
                &exe,
            ]),
            &[],
            &none,
        );
        let reasons: Vec<_> = report.refused.iter().map(|r| r.reason).collect();
        assert_eq!(
            reasons,
            [
                RejectReason::NotSupported,
                RejectReason::NotSupported,
                RejectReason::NotFound,
                RejectReason::NotSupported,
                RejectReason::NotSupported,
                RejectReason::Repeated,
            ]
        );
        assert_eq!(report.candidates.len(), 1);
    }

    #[test]
    fn an_app_already_in_the_list_is_flagged_not_dropped() {
        let dir = tempfile::tempdir().unwrap();
        let exe = dir.path().join("Game.exe");
        fs::write(&exe, b"MZ").unwrap();
        let path = exe.to_string_lossy().to_string();
        // Same path with other letter case and slashes: still the same app.
        let entry = existing(&path.to_uppercase().replace('\\', "/"));
        let report = inspect(&inputs(&[&path]), &[entry], &none);
        assert!(report.candidates[0].already_added);
    }

    #[test]
    fn a_huge_drop_is_capped() {
        let many: Vec<String> = (0..MAX_INPUTS + 3)
            .map(|i| format!("https://example.com/{i}"))
            .collect();
        let report = inspect(&many, &[], &none);
        assert_eq!(report.candidates.len(), MAX_INPUTS);
        assert_eq!(report.refused.len(), 3);
        assert!(report
            .refused
            .iter()
            .all(|r| r.reason == RejectReason::TooMany));
    }
}
