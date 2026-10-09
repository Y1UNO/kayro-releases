//! Epic Games Store: one JSON `*.item` manifest per installed item in
//! `%ProgramData%\Epic\EpicGamesLauncher\Data\Manifests`. Launch goes through the launcher's
//! protocol: `com.epicgames.launcher://apps/<AppName>?action=launch&silent=true`.
//!
//! The format is community-documented, not official: every field is read defensively. No Epic
//! game is installed on the development PC, so the parser is covered by fixtures built from the
//! documented format only.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::{short_hash, DetectError, DetectSource, DetectedApp, ScanCtx, SourceKind};
use crate::config::apps::{AppSource, Launch, MatchRule};

const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;
const MAX_ID_SLUG: usize = 34;

pub struct EpicSource {
    manifests: PathBuf,
}

impl EpicSource {
    pub fn system() -> Self {
        let program_data =
            std::env::var_os("ProgramData").unwrap_or_else(|| "C:\\ProgramData".into());
        Self::with_dir(PathBuf::from(program_data).join("Epic\\EpicGamesLauncher\\Data\\Manifests"))
    }

    pub fn with_dir(manifests: PathBuf) -> Self {
        Self { manifests }
    }
}

impl DetectSource for EpicSource {
    fn kind(&self) -> SourceKind {
        SourceKind::Epic
    }

    fn scan(&self, ctx: &ScanCtx) -> Result<Vec<DetectedApp>, DetectError> {
        let entries = match fs::read_dir(&self.manifests) {
            Ok(e) => e,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                tracing::info!("epic: no manifests folder, nothing to detect");
                return Ok(Vec::new());
            }
            Err(e) => return Err(e.into()),
        };
        let mut apps: Vec<DetectedApp> = Vec::new();
        for entry in entries.flatten() {
            if ctx.cancelled() {
                break;
            }
            let path = entry.path();
            let is_item = path.is_file()
                && path
                    .extension()
                    .is_some_and(|e| e.eq_ignore_ascii_case("item"));
            if !is_item {
                continue;
            }
            let label = entry.file_name().to_string_lossy().into_owned();
            match read_item(&path).and_then(|v| parse_item(&v)) {
                Ok(Some(app)) => {
                    if apps.iter().any(|a| a.id == app.id) {
                        ctx.skip(&label, "duplicate id");
                    } else {
                        apps.extend(ctx.accept(SourceKind::Epic, app));
                    }
                }
                Ok(None) => ctx.skip(&label, "not a launchable game (DLC, tool or incomplete)"),
                Err(e) => {
                    ctx.skip(&label, &e);
                    tracing::warn!(file = %label, error = %e, "epic: manifest ignored");
                }
            }
        }
        apps.sort_by_key(|a| a.name.to_lowercase());
        Ok(apps)
    }
}

fn read_item(path: &Path) -> Result<Value, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_MANIFEST_BYTES {
        return Err(format!("manifest too large ({} bytes)", meta.len()));
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    serde_json::from_str(text.trim_start_matches('\u{feff}')).map_err(|e| e.to_string())
}

fn string<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key)?
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

/// `AppName` ends up in a protocol URI: only plain identifier characters are accepted.
fn is_safe_app_name(name: &str) -> bool {
    name.len() <= 100
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}

fn app_id(app_name: &str) -> String {
    let slug = app_name.to_ascii_lowercase();
    let plain = slug
        .bytes()
        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if plain && slug.len() <= MAX_ID_SLUG {
        format!("epic-{slug}")
    } else {
        format!("epic-{}", short_hash(app_name))
    }
}

/// `Ok(None)`: a valid manifest that is not a launchable game. `Err`: unusable manifest.
pub(crate) fn parse_item(v: &Value) -> Result<Option<DetectedApp>, String> {
    if !v.is_object() {
        return Err("root is not an object".into());
    }
    let app_name = string(v, "AppName").ok_or("no AppName")?;
    if !is_safe_app_name(app_name) {
        return Err("AppName has unexpected characters".into());
    }
    let name = string(v, "DisplayName").ok_or("no DisplayName")?;
    let flag = |key: &str, default: bool| v.get(key).and_then(Value::as_bool).unwrap_or(default);
    if flag("bIsIncompleteInstall", false) || !flag("bIsApplication", true) {
        return Ok(None);
    }
    // DLC and add-ons name their base game in `MainGameAppName` and have nothing to run.
    if string(v, "MainGameAppName").is_some_and(|main| main != app_name) {
        return Ok(None);
    }
    let Some(executable) = string(v, "LaunchExecutable") else {
        return Ok(None);
    };
    let exe_name = executable
        .rsplit(['\\', '/'])
        .next()
        .filter(|f| f.to_ascii_lowercase().ends_with(".exe"))
        .map(str::to_string);
    Ok(Some(DetectedApp {
        id: app_id(app_name),
        name: name.to_string(),
        source: AppSource::Epic {
            app_name: app_name.to_string(),
        },
        launch: Launch::Uri {
            uri: format!("com.epicgames.launcher://apps/{app_name}?action=launch&silent=true"),
        },
        match_rule: MatchRule { exe: exe_name },
        poster_path: None,
        hero_path: None,
        already_added: false,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detect::CancelToken;
    use serde_json::json;

    const INSTALLED: &str = include_str!("../../tests/fixtures/epic/installed.item");
    const DLC: &str = include_str!("../../tests/fixtures/epic/dlc.item");
    const INCOMPLETE: &str = include_str!("../../tests/fixtures/epic/incomplete.item");
    const TRUNCATED: &str = include_str!("../../tests/fixtures/epic/truncated.item");

    fn parse(text: &str) -> Result<Option<DetectedApp>, String> {
        serde_json::from_str::<Value>(text)
            .map_err(|e| e.to_string())
            .and_then(|v| parse_item(&v))
    }

    #[test]
    fn installed_game_is_proposed_with_the_protocol_launch() {
        let app = parse(INSTALLED).unwrap().unwrap();
        assert_eq!(app.id, "epic-demoappname");
        assert_eq!(app.name, "Demo Epic Game");
        assert_eq!(
            app.launch,
            Launch::Uri {
                uri: "com.epicgames.launcher://apps/DemoAppName?action=launch&silent=true".into()
            }
        );
        assert_eq!(app.match_rule.exe.as_deref(), Some("DemoGame.exe"));
    }

    #[test]
    fn dlc_and_incomplete_installs_are_not_games() {
        assert_eq!(parse(DLC), Ok(None));
        assert_eq!(parse(INCOMPLETE), Ok(None));
        assert_eq!(parse(&json!({"AppName":"a","DisplayName":"A","bIsApplication":false,"LaunchExecutable":"a.exe"}).to_string()), Ok(None));
    }

    #[test]
    fn damaged_manifests_are_errors() {
        assert!(parse(TRUNCATED).is_err());
        assert!(parse("").is_err());
        assert!(parse("[]").is_err());
        assert!(parse("{}").is_err());
        assert!(parse(r#"{"AppName":"a"}"#).is_err());
        // An AppName that could alter the URI is refused.
        assert!(
            parse(r#"{"AppName":"a?b=c&d","DisplayName":"A","LaunchExecutable":"a.exe"}"#).is_err()
        );
    }

    #[test]
    fn long_or_unusual_names_get_a_hashed_id() {
        let a = app_id("Some.Mixed_Name");
        assert!(a.starts_with("epic-") && crate::config::validate::validate_id(&a).is_ok());
        let b = app_id(&"x".repeat(80));
        assert!(crate::config::validate::validate_id(&b).is_ok());
        assert_eq!(app_id("Some.Mixed_Name"), a);
    }

    #[test]
    fn scan_reads_a_folder_and_survives_bad_files() {
        let dir = tempfile::tempdir().unwrap();
        let put = |n: &str, t: &str| fs::write(dir.path().join(n), t).unwrap();
        put("a.item", INSTALLED);
        put("b.item", DLC);
        put("c.item", INCOMPLETE);
        put("d.item", TRUNCATED);
        put("e.item", "");
        put("notes.txt", "ignored");
        fs::create_dir(dir.path().join("Pending")).unwrap();
        let ctx = ScanCtx::new(CancelToken::default());
        let apps = EpicSource::with_dir(dir.path().to_path_buf())
            .scan(&ctx)
            .unwrap();
        assert_eq!(apps.len(), 1);
        assert_eq!(ctx.skipped(), 4);
    }

    #[test]
    fn missing_folder_means_epic_is_not_installed() {
        let dir = tempfile::tempdir().unwrap();
        let src = EpicSource::with_dir(dir.path().join("nope"));
        assert!(src.scan(&ScanCtx::default()).unwrap().is_empty());
    }
}
