use serde::{Serialize, Serializer};

/// Error type returned by IPC commands (serialised as a plain message).
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("window not found: {0}")]
    WindowNotFound(String),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
