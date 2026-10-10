use std::path::{Path, PathBuf};

/// Frozen name of the user-data folder (`%APPDATA%/Kayro`). It never follows the display
/// name (`productName`), so a rename can never move the user's data.
pub const DATA_DIR: &str = "Kayro";

/// Folder used before the project got its final name; copied once by `legacy`.
pub const LEGACY_DATA_DIR: &str = "Hub";

/// `%APPDATA%`, or the temp dir if it is missing.
pub fn appdata_base() -> PathBuf {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
}

/// `%APPDATA%/Kayro`, or a folder next to the temp dir if `APPDATA` is missing.
pub fn data_dir() -> PathBuf {
    appdata_base().join(DATA_DIR)
}

pub fn logs_dir() -> PathBuf {
    data_dir().join("logs")
}

/// Layout of the data folder (ARCHITECTURE.md §2). The root is injectable so tests never
/// touch the real `%APPDATA%`.
#[derive(Debug, Clone)]
pub struct DataPaths {
    root: PathBuf,
}

impl DataPaths {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn default_location() -> Self {
        Self::new(data_dir())
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn settings(&self) -> PathBuf {
        self.root.join("settings.json")
    }

    pub fn apps(&self) -> PathBuf {
        self.root.join("apps.json")
    }

    pub fn slots(&self) -> PathBuf {
        self.root.join("slots.json")
    }

    pub fn scenes_dir(&self) -> PathBuf {
        self.root.join("scenes")
    }

    /// Scenes exported for sharing (`exports/<id>.hubscene`).
    pub fn exports_dir(&self) -> PathBuf {
        self.root.join("exports")
    }

    pub fn themes_dir(&self) -> PathBuf {
        self.root.join("themes")
    }

    /// Icons extracted from programs and shortcuts (`cache/icons/`), rebuilt on demand.
    pub fn icons_dir(&self) -> PathBuf {
        self.root.join("cache").join("icons")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logs_dir_is_under_data_dir() {
        assert!(logs_dir().starts_with(data_dir()));
        assert!(data_dir().ends_with(DATA_DIR));
    }

    #[test]
    fn layout_follows_the_root() {
        let p = DataPaths::new("X:/data");
        assert!(p.apps().starts_with("X:/data") && p.apps().ends_with("apps.json"));
        assert!(p.themes_dir().ends_with("themes"));
    }
}
