use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    /// The input was refused by validation (`field` tells which one when known).
    Validation,
    NotFound,
    Duplicate,
    /// Reading or writing user data failed.
    Io,
    Internal,
    /// Something of the same kind is already running (a scene is already being played).
    Busy,
    /// The program, shortcut or protocol handler to start does not exist or is not installed.
    LaunchNotFound,
    /// Windows refused to start it (access denied).
    LaunchDenied,
    /// It needs administrator rights and the app is not configured to run elevated.
    ElevationRequired,
    /// The user dismissed the administrator prompt.
    ElevationCancelled,
    /// Any other failure to start (`message` has the Win32 code).
    LaunchFailed,
}

/// Error returned by IPC commands. `message` is for logs and developers; the UI shows its own
/// translated text chosen from `code`.
#[derive(Debug, Clone, Serialize, Deserialize, Type, thiserror::Error)]
#[error("{message}")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub field: Option<String>,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            field: None,
        }
    }

    pub fn validation(field: &str, message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::Validation,
            message: message.into(),
            field: Some(field.into()),
        }
    }

    pub fn not_found(what: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotFound, format!("not found: {}", what.into()))
    }
}

impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        Self::new(ErrorCode::Internal, e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::new(ErrorCode::Io, e.to_string())
    }
}
