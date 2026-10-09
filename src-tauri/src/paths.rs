use std::path::PathBuf;

/// Frozen name of the user-data folder (`%APPDATA%/Hub`). It never follows the display
/// name (`productName`), so a rename can never move the user's data.
pub const DATA_DIR: &str = "Hub";

/// `%APPDATA%/Hub`, or a folder next to the temp dir if `APPDATA` is missing.
pub fn data_dir() -> PathBuf {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join(DATA_DIR)
}

pub fn logs_dir() -> PathBuf {
    data_dir().join("logs")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logs_dir_is_under_data_dir() {
        assert!(logs_dir().starts_with(data_dir()));
        assert!(data_dir().ends_with(DATA_DIR));
    }
}
