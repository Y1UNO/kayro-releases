//! `apps.json`: the applications the hub is allowed to launch (and nothing else).

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

use super::store::{Document, LoadReport, Rejected};
use super::validate::{validate_app, MAX_APPS};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum AppSource {
    Manual,
    Steam {
        #[serde(rename = "appId")]
        app_id: String,
    },
    Epic {
        #[serde(rename = "appName")]
        app_name: String,
    },
    Startmenu,
}

/// How to start an app. Exactly one of a closed set of kinds; each is validated on its own.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Launch {
    Exe {
        path: String,
        args: Vec<String>,
        cwd: Option<String>,
        elevated: bool,
    },
    Lnk {
        path: String,
    },
    /// Protocol URI of a known launcher (`steam://…`, `com.epicgames.launcher://…`).
    Uri {
        uri: String,
    },
    /// Packaged (UWP) app, by Application User Model ID.
    Uwp {
        aumid: String,
    },
    Url {
        url: String,
    },
}

/// Which process to watch to know the app is running.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
pub struct MatchRule {
    pub exe: Option<String>,
}

/// Cached images, as paths relative to the data folder (`cache/art/…`).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
pub struct Art {
    pub poster: Option<String>,
    pub hero: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub category: String,
    pub source: AppSource,
    pub launch: Launch,
    #[serde(rename = "match")]
    pub match_rule: MatchRule,
    pub art: Art,
    pub mood_id: Option<String>,
    pub favorite: bool,
}

/// Hand-edited files may leave out optional parts; fill them in before the strict parse so the
/// public types can keep every field required.
fn fill_defaults(entry: &mut Value) {
    let Some(o) = entry.as_object_mut() else {
        return;
    };
    o.entry("category").or_insert_with(|| "autres".into());
    o.entry("match").or_insert_with(|| serde_json::json!({}));
    o.entry("art").or_insert_with(|| serde_json::json!({}));
    o.entry("favorite").or_insert(Value::Bool(false));
    if let Some(launch) = o.get_mut("launch").and_then(Value::as_object_mut) {
        if launch.get("kind").and_then(Value::as_str) == Some("exe") {
            launch
                .entry("args")
                .or_insert_with(|| serde_json::json!([]));
            launch.entry("elevated").or_insert(Value::Bool(false));
        }
    }
}

/// An app to add: the id is chosen by the core, never by the caller.
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NewApp {
    pub name: String,
    pub category: String,
    pub source: AppSource,
    pub launch: Launch,
    #[serde(rename = "match")]
    pub match_rule: MatchRule,
    pub art: Art,
    pub mood_id: Option<String>,
    pub favorite: bool,
}

impl NewApp {
    pub fn with_id(self, id: String) -> AppEntry {
        AppEntry {
            id,
            name: self.name,
            category: self.category,
            source: self.source,
            launch: self.launch,
            match_rule: self.match_rule,
            art: self.art,
            mood_id: self.mood_id,
            favorite: self.favorite,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppsFile {
    pub schema_version: u32,
    pub apps: Vec<AppEntry>,
}

impl Default for AppsFile {
    fn default() -> Self {
        Self {
            schema_version: 1,
            apps: Vec::new(),
        }
    }
}

impl Document for AppsFile {
    const NAME: &'static str = "apps.json";

    /// Tolerant: unknown fields are ignored, and an invalid entry is set aside on its own
    /// (the others are kept). Only a root without a usable `apps` list is fatal.
    fn from_value(value: Value, report: &mut LoadReport) -> Result<Self, String> {
        let Value::Object(root) = value else {
            return Err("root is not an object".into());
        };
        for key in root
            .keys()
            .filter(|k| *k != "schemaVersion" && *k != "apps")
        {
            report.warn(format!("apps.json: unknown field «{key}» ignored"));
        }
        let items = match root.get("apps") {
            Some(Value::Array(items)) => items.clone(),
            Some(_) => return Err("«apps» is not a list".into()),
            None => Vec::new(),
        };
        let mut apps = Vec::with_capacity(items.len());
        let mut seen = HashSet::new();
        for item in items {
            let verdict = if apps.len() >= MAX_APPS {
                Err(format!("more than {MAX_APPS} apps"))
            } else {
                let mut filled = item.clone();
                fill_defaults(&mut filled);
                serde_json::from_value::<AppEntry>(filled)
                    .map_err(|e| e.to_string())
                    .and_then(|app| {
                        validate_app(&app).map_err(|e| e.to_string())?;
                        if seen.insert(app.id.clone()) {
                            Ok(app)
                        } else {
                            Err(format!("duplicate id «{}»", app.id))
                        }
                    })
            };
            match verdict {
                Ok(app) => apps.push(app),
                Err(reason) => report.rejected.push(Rejected {
                    reason,
                    entry: item,
                }),
            }
        }
        Ok(Self {
            schema_version: 1,
            apps,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::store::{load, save};
    use serde_json::json;
    use std::fs;

    fn entry(id: &str) -> Value {
        json!({"id": id, "name": id, "category": "jeux", "source": {"kind": "manual"},
               "launch": {"kind": "exe", "path": "C:\\Games\\a.exe"}})
    }

    fn write(content: &Value) -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("apps.json");
        fs::write(&p, serde_json::to_vec(content).unwrap()).unwrap();
        (dir, p)
    }

    #[test]
    fn architecture_example_parses() {
        let raw = json!({"id":"minecraft","name":"Minecraft","category":"jeux",
          "source":{"kind":"manual"},
          "launch":{"kind":"exe","path":"C:\\Games\\Minecraft.exe","args":[],"cwd":null,"elevated":false},
          "match":{"exe":"javaw.exe"},
          "art":{"poster":"cache/art/minecraft.poster.jpg","hero":null},
          "moodId":null,"favorite":false});
        let app: AppEntry = serde_json::from_value(raw).unwrap();
        assert_eq!(app.match_rule.exe.as_deref(), Some("javaw.exe"));
        validate_app(&app).unwrap();
    }

    #[test]
    fn roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("apps.json");
        let mut raw = entry("a");
        fill_defaults(&mut raw);
        let doc = AppsFile {
            schema_version: 1,
            apps: vec![serde_json::from_value(raw).unwrap()],
        };
        save(&p, &doc).unwrap();
        let (back, report) = load::<AppsFile>(&p);
        assert_eq!(back, doc);
        assert!(report.is_clean());
    }

    #[test]
    fn one_bad_entry_goes_to_rejected_and_the_rest_is_kept() {
        let mut bad_path = entry("bad-path");
        bad_path["launch"]["path"] = json!("relative\\a.exe");
        let doc = json!({"schemaVersion":1,"apps":[
            entry("one"), bad_path, json!({"id":"no-launch","name":"x"}), entry("two"), entry("one")]});
        let (_d, p) = write(&doc);
        let (apps, report) = load::<AppsFile>(&p);
        let ids: Vec<_> = apps.apps.iter().map(|a| a.id.as_str()).collect();
        assert_eq!(ids, ["one", "two"]);
        assert_eq!(report.rejected.len(), 3);
        assert!(report.quarantined.is_none());
        // The rejects are on disk beside the file, and apps.json no longer contains them.
        let side: Vec<Value> =
            serde_json::from_slice(&fs::read(format!("{}.rejected", p.display())).unwrap())
                .unwrap();
        assert_eq!(side.len(), 3);
        assert_eq!(side[0]["entry"]["id"], "bad-path");
        let (again, report2) = load::<AppsFile>(&p);
        assert_eq!(again, apps);
        assert!(report2.is_clean());
    }

    #[test]
    fn unknown_fields_are_ignored_and_the_file_stays_untouched() {
        let mut e = entry("a");
        e["somethingNew"] = json!(1);
        let doc = json!({"schemaVersion":1,"futureKey":true,"apps":[e]});
        let (_d, p) = write(&doc);
        let before = fs::read(&p).unwrap();
        let (apps, report) = load::<AppsFile>(&p);
        assert_eq!(apps.apps.len(), 1);
        assert!(report.quarantined.is_none() && report.rejected.is_empty());
        assert_eq!(report.warnings.len(), 1);
        assert_eq!(fs::read(&p).unwrap(), before);
    }

    #[test]
    fn apps_that_is_not_a_list_is_quarantined() {
        let (_d, p) = write(&json!({"schemaVersion":1,"apps":"oops"}));
        let (apps, report) = load::<AppsFile>(&p);
        assert!(apps.apps.is_empty() && report.quarantined.is_some());
    }

    #[test]
    fn hand_corrupted_file_never_crashes() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("apps.json");
        fs::write(&p, "{ \"schemaVersion\": 1, \"apps\": [ {\"id\": \"a\", ").unwrap();
        let (apps, report) = load::<AppsFile>(&p);
        assert!(apps.apps.is_empty());
        assert!(report.quarantined.unwrap().ends_with("apps.json.corrupt"));
    }
}
