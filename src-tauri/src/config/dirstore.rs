//! Folders of shared / imported files (`scenes/`, `themes/`): strict mode. A file that does not
//! fit its schema exactly is moved aside (`.corrupt`), never half-loaded.

use std::fs;
use std::path::Path;

use super::atomic::sibling;
use super::schema::StrictFile;

const MAX_FILES: usize = 500;
const MAX_FILE_BYTES: u64 = 1024 * 1024;

pub fn load_dir<T: StrictFile>(dir: &Path) -> Vec<T> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut files: Vec<_> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.extension().is_some_and(|e| e == "json"))
        .collect();
    files.sort();
    let mut out = Vec::new();
    for path in files {
        if out.len() >= MAX_FILES {
            tracing::warn!(dir = %dir.display(), "too many files, the rest is ignored");
            break;
        }
        match read_one::<T>(&path) {
            Ok(item) => out.push(item),
            Err(reason) => {
                let mut dest = sibling(&path, ".corrupt");
                let mut n = 0u32;
                while dest.exists() {
                    n += 1;
                    dest = sibling(&path, &format!(".corrupt.{n}"));
                }
                tracing::warn!(file = %path.display(), %reason, "rejected, moved aside");
                let _ = fs::rename(&path, dest);
            }
        }
    }
    out
}

fn read_one<T: StrictFile>(path: &Path) -> Result<T, String> {
    let size = fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > MAX_FILE_BYTES {
        return Err(format!("file too large ({size} bytes)"));
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let item: T = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    item.check()?;
    Ok(item)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::schema::{SceneFile, ThemeFile};
    use serde_json::json;

    fn theme(id: &str) -> serde_json::Value {
        json!({"schemaVersion":1,"id":id,"name":"T","author":"a","description":"d",
               "bg":["#000","#111","#222"],"accent":"#fff","glow":"#eee",
               "fog":["rgba(0,0,0,.1)","rgba(0,0,0,.1)","rgba(0,0,0,.1)"],"card":[1,2,3],"beam":[4,5,6]})
    }

    #[test]
    fn valid_files_load_and_missing_dir_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load_dir::<ThemeFile>(&dir.path().join("nope")).is_empty());
        fs::write(dir.path().join("a.json"), theme("a").to_string()).unwrap();
        fs::write(dir.path().join("notes.txt"), "ignored").unwrap();
        let themes = load_dir::<ThemeFile>(dir.path());
        assert_eq!(themes.len(), 1);
        assert_eq!(themes[0].card, [1, 2, 3]);
    }

    #[test]
    fn strict_mode_rejects_unknown_fields_and_bad_content() {
        let dir = tempfile::tempdir().unwrap();
        let mut extra = theme("extra");
        extra["script"] = json!("alert(1)");
        let mut bad_id = theme("Bad Id");
        bad_id["id"] = json!("Bad Id");
        fs::write(dir.path().join("extra.json"), extra.to_string()).unwrap();
        fs::write(dir.path().join("bad.json"), bad_id.to_string()).unwrap();
        fs::write(dir.path().join("trunc.json"), "{\"schemaVersion\":1,").unwrap();
        fs::write(dir.path().join("good.json"), theme("good").to_string()).unwrap();
        let themes = load_dir::<ThemeFile>(dir.path());
        assert_eq!(themes.len(), 1);
        assert_eq!(themes[0].id, "good");
        for name in ["extra", "bad", "trunc"] {
            assert!(
                dir.path().join(format!("{name}.json.corrupt")).exists(),
                "{name}"
            );
            assert!(!dir.path().join(format!("{name}.json")).exists(), "{name}");
        }
    }

    #[test]
    fn oversized_file_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let big = json!({"schemaVersion":1,"id":"big","name":"x".repeat(2_000_000),"steps":[]});
        fs::write(dir.path().join("big.json"), big.to_string()).unwrap();
        assert!(load_dir::<SceneFile>(dir.path()).is_empty());
        assert!(dir.path().join("big.json.corrupt").exists());
    }
}
