//! Tests of the versioned-document store (load / save / migrate / recover).

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::atomic::{sibling, stage};
use super::migrate::Migration;
use super::store::{lenient_merge, load, save, Document, LoadReport};

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Doc {
    schema_version: u32,
    name: String,
    count: u32,
    extra: bool,
}
impl Default for Doc {
    fn default() -> Self {
        Self {
            schema_version: 3,
            name: "default".into(),
            count: 7,
            extra: false,
        }
    }
}
fn v1_to_v2(mut v: Value) -> Result<Value, String> {
    let o = v.as_object_mut().ok_or("not an object")?;
    let title = o.remove("title").unwrap_or(Value::Null);
    o.insert("name".into(), title);
    Ok(v)
}
fn v2_to_v3(mut v: Value) -> Result<Value, String> {
    v.as_object_mut()
        .ok_or("not an object")?
        .insert("extra".into(), json!(true));
    Ok(v)
}
fn failing(_: Value) -> Result<Value, String> {
    Err("boom".into())
}
impl Document for Doc {
    const NAME: &'static str = "doc.json";
    const MIGRATIONS: &'static [Migration] = &[v1_to_v2, v2_to_v3];
    fn from_value(value: Value, report: &mut LoadReport) -> Result<Self, String> {
        Ok(lenient_merge(value, report, |_| Ok(())))
    }
}
#[derive(Debug, Default, Serialize)]
struct Broken;
impl Document for Broken {
    const NAME: &'static str = "broken.json";
    const MIGRATIONS: &'static [Migration] = &[failing];
    fn from_value(_: Value, _: &mut LoadReport) -> Result<Self, String> {
        Ok(Broken)
    }
}

fn setup(content: &[u8]) -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("doc.json");
    fs::write(&p, content).unwrap();
    (dir, p)
}

#[test]
fn missing_file_gives_defaults_without_creating_anything() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("doc.json");
    let (doc, report) = load::<Doc>(&p);
    assert_eq!(doc, Doc::default());
    assert!(report.is_clean() && !p.exists());
}

#[test]
fn utf8_bom_from_a_windows_editor_is_accepted() {
    let (_d, p) = setup(b"\xEF\xBB\xBF{\"schemaVersion\":3,\"name\":\"bom\"}");
    let (doc, report) = load::<Doc>(&p);
    assert_eq!(doc.name, "bom");
    assert!(report.is_clean());
}

#[test]
fn roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("doc.json");
    let doc = Doc {
        name: "kept".into(),
        count: 9,
        ..Doc::default()
    };
    save(&p, &doc).unwrap();
    let (back, report) = load::<Doc>(&p);
    assert_eq!(back, doc);
    assert!(report.is_clean());
}

#[test]
fn migrates_step_by_step_with_backup_and_rewrite() {
    let original = br#"{"schemaVersion":1,"title":"old","count":2}"#;
    let (_d, p) = setup(original);
    let (doc, report) = load::<Doc>(&p);
    assert_eq!(
        doc,
        Doc {
            schema_version: 3,
            name: "old".into(),
            count: 2,
            extra: true
        }
    );
    assert_eq!(report.migrated_from, Some(1));
    assert_eq!(fs::read(sibling(&p, ".bak")).unwrap(), original);
    let on_disk: Value = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
    assert_eq!(on_disk["schemaVersion"], 3);
}

#[test]
fn failed_migration_quarantines_and_keeps_the_backup() {
    let original = br#"{"schemaVersion":1}"#;
    let (_d, p) = setup(original);
    let (doc, report) = load::<Broken>(&p);
    let _ = doc;
    let q = report.quarantined.expect("quarantined");
    assert_eq!(fs::read(q).unwrap(), original);
    assert_eq!(fs::read(sibling(&p, ".bak")).unwrap(), original);
    assert!(!p.exists());
}

#[test]
fn newer_schema_is_never_overwritten() {
    let original = br#"{"schemaVersion":99,"name":"future"}"#;
    let (_d, p) = setup(original);
    let (doc, report) = load::<Doc>(&p);
    assert_eq!(doc, Doc::default());
    assert_eq!(fs::read(report.quarantined.unwrap()).unwrap(), original);
}

#[test]
fn unreadable_content_is_quarantined_not_fatal() {
    let cases: [&[u8]; 6] = [
        b"",
        b"{\"schemaVersion\":3,\"name\":",
        b"\xff\xfe\x00garbage",
        b"[1,2,3]",
        b"{\"name\":\"no version\"}",
        b"{\"schemaVersion\":\"3\"}",
    ];
    for bytes in cases {
        let (_d, p) = setup(bytes);
        let (doc, report) = load::<Doc>(&p);
        assert_eq!(doc, Doc::default(), "{bytes:?}");
        let q = report
            .quarantined
            .unwrap_or_else(|| panic!("not quarantined: {bytes:?}"));
        assert_eq!(fs::read(q).unwrap(), bytes);
        assert!(!p.exists());
    }
}

#[test]
fn successive_corruptions_never_overwrite_each_other() {
    let (_d, p) = setup(b"first");
    let a = load::<Doc>(&p).1.quarantined.unwrap();
    fs::write(&p, b"second").unwrap();
    let b = load::<Doc>(&p).1.quarantined.unwrap();
    assert_ne!(a, b);
    assert_eq!(fs::read(a).unwrap(), b"first");
    assert_eq!(fs::read(b).unwrap(), b"second");
}

#[test]
fn unknown_field_is_ignored_and_the_file_is_left_alone() {
    let content = br#"{"schemaVersion":3,"name":"mine","count":1,"extra":false,"futureThing":42}"#;
    let (_d, p) = setup(content);
    let (doc, report) = load::<Doc>(&p);
    assert_eq!(doc.name, "mine");
    assert!(report.quarantined.is_none() && report.warnings.len() == 1);
    assert_eq!(fs::read(&p).unwrap(), content);
}

#[test]
fn invalid_field_falls_back_to_its_default_only() {
    let (_d, p) = setup(br#"{"schemaVersion":3,"name":"mine","count":"many","extra":true}"#);
    let (doc, report) = load::<Doc>(&p);
    assert_eq!(
        doc,
        Doc {
            schema_version: 3,
            name: "mine".into(),
            count: 7,
            extra: true
        }
    );
    assert!(report.quarantined.is_none());
}

#[test]
fn interrupted_write_leaves_the_old_file_and_the_leftover_is_cleaned() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("doc.json");
    save(
        &p,
        &Doc {
            name: "old".into(),
            ..Doc::default()
        },
    )
    .unwrap();
    let tmp = stage(&p, b"{\"half").unwrap(); // crash before the rename
    assert!(tmp.exists());
    let (doc, report) = load::<Doc>(&p);
    assert_eq!(doc.name, "old");
    assert!(report.is_clean() && !tmp.exists());
}
