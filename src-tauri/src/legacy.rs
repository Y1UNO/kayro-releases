//! One-time copy of the pre-rename data folder (`%APPDATA%/Hub`) to `%APPDATA%/Kayro`.
//! The old folder is only ever read: never modified, never deleted.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::paths::{DATA_DIR, LEGACY_DATA_DIR};

#[derive(Debug, PartialEq, Eq)]
pub enum Migration {
    /// No old folder, or the new one already exists.
    NotNeeded,
    Copied {
        files: u64,
        from: PathBuf,
        to: PathBuf,
    },
    Failed {
        from: PathBuf,
        error: String,
    },
}

fn copy_tree(from: &Path, to: &Path) -> io::Result<u64> {
    fs::create_dir_all(to)?;
    let mut files = 0;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_dir() {
            files += copy_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            fs::copy(entry.path(), &target)?;
            files += 1;
        }
        // Links and other entries are not part of the user data: skipped.
    }
    Ok(files)
}

/// Copies `<base>/Hub` to `<base>/Kayro` when the first exists and the second does not. The copy
/// goes to a temporary sibling first and is renamed at the end, so `Kayro` never exists half
/// copied (an interrupted copy is simply redone at the next start).
pub fn migrate_legacy_data(base: &Path) -> Migration {
    let from = base.join(LEGACY_DATA_DIR);
    let to = base.join(DATA_DIR);
    if !from.is_dir() || to.exists() {
        return Migration::NotNeeded;
    }
    let partial = base.join(format!("{DATA_DIR}.migrating"));
    let result = (|| {
        if partial.exists() {
            fs::remove_dir_all(&partial)?;
        }
        let files = copy_tree(&from, &partial)?;
        fs::rename(&partial, &to)?;
        Ok::<_, io::Error>(files)
    })();
    match result {
        Ok(files) => Migration::Copied { files, from, to },
        Err(e) => {
            let _ = fs::remove_dir_all(&partial);
            Migration::Failed {
                from,
                error: e.to_string(),
            }
        }
    }
}

pub fn log_outcome(migration: &Migration) {
    match migration {
        Migration::NotNeeded => {}
        Migration::Copied { files, from, to } => {
            tracing::info!(files, from = %from.display(), to = %to.display(), "user data copied from the old folder (kept untouched)");
        }
        Migration::Failed { from, error } => {
            tracing::error!(from = %from.display(), %error, "could not copy the old user data folder");
        }
    }
}

/// Folders of features removed since (2026-11-07: the voice and the hands, by the user's choice):
/// their models (up to 5.9 GB) and the voice's calibration recordings (`voice/me`).
const RETIRED: [&str; 2] = ["voice", "hands"];

/// Deletes the data of the removed features from `data` (the Kayro folder), once: they are gone
/// on the next start. Returns the folders deleted; a failure is logged and retried next time.
pub fn remove_retired(data: &Path) -> Vec<&'static str> {
    RETIRED
        .into_iter()
        .filter(|name| {
            let dir = data.join(name);
            if !dir.is_dir() {
                return false;
            }
            match fs::remove_dir_all(&dir) {
                Ok(()) => true,
                Err(error) => {
                    tracing::warn!(folder = name, %error, "could not delete a removed feature's data");
                    false
                }
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_voice_and_hands_data_are_deleted_and_nothing_else() {
        let dir = tempfile::tempdir().unwrap();
        let data = dir.path();
        fs::create_dir_all(data.join("voice").join("me")).unwrap();
        fs::write(data.join("voice").join("me").join("say.wav"), [1, 2]).unwrap();
        fs::create_dir_all(data.join("hands")).unwrap();
        fs::create_dir_all(data.join("scenes")).unwrap();
        fs::write(data.join("settings.json"), "{}").unwrap();
        assert_eq!(remove_retired(data), vec!["voice", "hands"]);
        assert!(!data.join("voice").exists() && !data.join("hands").exists());
        assert!(data.join("scenes").is_dir() && data.join("settings.json").is_file());
        assert!(remove_retired(data).is_empty());
    }

    fn old_data(base: &Path) -> PathBuf {
        let hub = base.join("Hub");
        fs::create_dir_all(hub.join("scenes")).unwrap();
        fs::create_dir_all(hub.join("cache").join("icons")).unwrap();
        fs::write(hub.join("apps.json"), r#"{"apps":["a"]}"#).unwrap();
        fs::write(hub.join("slots.json"), "{}").unwrap();
        fs::write(hub.join("scenes").join("s.json"), "scene").unwrap();
        fs::write(hub.join("cache").join("icons").join("i.png"), [1, 2, 3]).unwrap();
        hub
    }

    #[test]
    fn copies_everything_and_leaves_the_old_folder_intact() {
        let base = tempfile::tempdir().unwrap();
        let hub = old_data(base.path());
        let out = migrate_legacy_data(base.path());
        assert!(matches!(out, Migration::Copied { files: 4, .. }), "{out:?}");
        let kayro = base.path().join("Kayro");
        assert_eq!(
            fs::read_to_string(kayro.join("apps.json")).unwrap(),
            r#"{"apps":["a"]}"#
        );
        assert_eq!(
            fs::read(kayro.join("cache/icons/i.png")).unwrap(),
            [1, 2, 3]
        );
        assert!(kayro.join("scenes/s.json").is_file());
        // Old folder untouched.
        assert_eq!(
            fs::read_to_string(hub.join("apps.json")).unwrap(),
            r#"{"apps":["a"]}"#
        );
        assert!(hub.join("scenes/s.json").is_file());
        assert!(!base.path().join("Kayro.migrating").exists());
    }

    #[test]
    fn is_a_noop_when_the_new_folder_exists_or_the_old_one_does_not() {
        let base = tempfile::tempdir().unwrap();
        assert_eq!(migrate_legacy_data(base.path()), Migration::NotNeeded);
        old_data(base.path());
        fs::create_dir_all(base.path().join("Kayro")).unwrap();
        fs::write(base.path().join("Kayro").join("apps.json"), "mine").unwrap();
        assert_eq!(migrate_legacy_data(base.path()), Migration::NotNeeded);
        assert_eq!(
            fs::read_to_string(base.path().join("Kayro/apps.json")).unwrap(),
            "mine"
        );
    }

    #[test]
    fn runs_only_once() {
        let base = tempfile::tempdir().unwrap();
        old_data(base.path());
        assert!(matches!(
            migrate_legacy_data(base.path()),
            Migration::Copied { .. }
        ));
        fs::write(base.path().join("Kayro/apps.json"), "edited").unwrap();
        assert_eq!(migrate_legacy_data(base.path()), Migration::NotNeeded);
        assert_eq!(
            fs::read_to_string(base.path().join("Kayro/apps.json")).unwrap(),
            "edited"
        );
    }

    #[test]
    fn redoes_an_interrupted_copy() {
        let base = tempfile::tempdir().unwrap();
        old_data(base.path());
        fs::create_dir_all(base.path().join("Kayro.migrating")).unwrap();
        fs::write(base.path().join("Kayro.migrating/stale.json"), "x").unwrap();
        assert!(matches!(
            migrate_legacy_data(base.path()),
            Migration::Copied { files: 4, .. }
        ));
        assert!(!base.path().join("Kayro/stale.json").exists());
    }
}
