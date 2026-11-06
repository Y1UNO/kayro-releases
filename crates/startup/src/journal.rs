//! `startup-journal.json`: the entries Kayro switched off and their mark before, to put back.

use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const FILE: &str = "startup-journal.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    id: String,
    /// The mark before Kayro switched it off (`None`: there was none).
    before: Option<Vec<u8>>,
    /// When (seconds since 1970).
    at: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct File {
    schema_version: u32,
    entries: Vec<Record>,
}

#[derive(Debug)]
pub struct Journal {
    path: PathBuf,
    entries: Vec<Record>,
}

impl Journal {
    /// The journal in Kayro's data folder (`%APPDATA%/Kayro`); missing or unreadable = empty.
    pub fn load(data_dir: &Path) -> Self {
        let path = data_dir.join(FILE);
        let entries = std::fs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str::<File>(&t).ok())
            .map(|f| f.entries)
            .unwrap_or_default();
        Self { path, entries }
    }

    pub fn contains(&self, id: &str) -> bool {
        self.entries.iter().any(|r| r.id == id)
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Keeps the first mark seen: switched off twice, the one from before Kayro stays.
    pub(crate) fn record(&mut self, id: &str, before: Option<Vec<u8>>) {
        if !self.contains(id) {
            self.entries.push(Record {
                id: id.to_string(),
                before,
                at: super::now(),
            });
        }
    }

    /// Removes `id`, giving back its mark before (`Some(None)`: there was none).
    pub(crate) fn take(&mut self, id: &str) -> Option<Option<Vec<u8>>> {
        let i = self.entries.iter().position(|r| r.id == id)?;
        Some(self.entries.remove(i).before)
    }

    pub(crate) fn drain(&mut self) -> Vec<(String, Option<Vec<u8>>)> {
        self.entries.drain(..).map(|r| (r.id, r.before)).collect()
    }

    /// Written whole to a temporary file, then put in place (never half written).
    pub fn save(&self) -> io::Result<()> {
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let file = File {
            schema_version: 1,
            entries: self.entries.clone(),
        };
        let text = serde_json::to_string_pretty(&file).map_err(io::Error::other)?;
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, text)?;
        std::fs::rename(&tmp, &self.path)
    }
}
