//! The one path through which the hub starts anything. Scenes, search and the widget all call
//! [`launch_app`]; nothing else in the program spawns user software.
//!
//! The hub only starts what is in `apps.json`: the request is built from a stored [`AppEntry`]
//! and re-validated first, so a damaged or hand-edited entry can never reach the system.

#[cfg(test)]
pub mod fake;
pub mod request;
pub mod system;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::config::apps::AppEntry;
use crate::error::{AppError, ErrorCode};
use crate::platform::Win32Error;
use crate::procwatch::RunningApps;
use request::LaunchRequest;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaunchOutcome {
    /// Known for programs and packaged apps; usually not for links handed to another process.
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum LaunchError {
    #[error("not found")]
    NotFound,
    #[error("access denied")]
    AccessDenied,
    #[error("administrator rights required")]
    ElevationRequired,
    #[error("administrator prompt cancelled")]
    ElevationCancelled,
    #[error("invalid app: {0}")]
    Invalid(String),
    #[error("Win32 error {0}")]
    Other(u32),
}

impl LaunchError {
    pub fn classify(error: Win32Error) -> Self {
        const NO_ASSOCIATION: u32 = 1155;
        match error.0 {
            Win32Error::FILE_NOT_FOUND | Win32Error::PATH_NOT_FOUND | NO_ASSOCIATION => {
                Self::NotFound
            }
            Win32Error::ACCESS_DENIED => Self::AccessDenied,
            Win32Error::ELEVATION_REQUIRED => Self::ElevationRequired,
            Win32Error::CANCELLED => Self::ElevationCancelled,
            code => Self::Other(code),
        }
    }
}

impl From<LaunchError> for AppError {
    fn from(e: LaunchError) -> Self {
        let code = match &e {
            LaunchError::NotFound => ErrorCode::LaunchNotFound,
            LaunchError::AccessDenied => ErrorCode::LaunchDenied,
            LaunchError::ElevationRequired => ErrorCode::ElevationRequired,
            LaunchError::ElevationCancelled => ErrorCode::ElevationCancelled,
            LaunchError::Invalid(_) => ErrorCode::Validation,
            LaunchError::Other(_) => ErrorCode::LaunchFailed,
        };
        AppError::new(code, e.to_string())
    }
}

/// Starts a request. The real implementation talks to Windows; tests use `FakeLauncher`.
pub trait Launcher: Send + Sync {
    fn launch(&self, request: &LaunchRequest) -> Result<LaunchOutcome, LaunchError>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LaunchResult {
    Started {
        pid: Option<u32>,
    },
    /// The app was already open: its window was brought to the front instead.
    FocusedExisting,
}

/// Opens `entry`. An app that is already running (and whose window can be reached) is brought
/// to the front rather than started a second time.
pub fn launch_app(
    launcher: &dyn Launcher,
    running: &dyn RunningApps,
    entry: &AppEntry,
) -> Result<LaunchResult, LaunchError> {
    let request = LaunchRequest::from_entry(entry)?;
    let pids = running.pids_of(&entry.id);
    if !pids.is_empty() && running.bring_to_front(&pids) {
        tracing::info!(app = %entry.id, "already running: brought to front");
        return Ok(LaunchResult::FocusedExisting);
    }
    let outcome = launcher.launch(&request).inspect_err(|e| {
        tracing::warn!(app = %entry.id, error = %e, "launch failed");
    })?;
    tracing::info!(app = %entry.id, pid = ?outcome.pid, "launched");
    running.note_launch();
    Ok(LaunchResult::Started { pid: outcome.pid })
}

#[cfg(test)]
mod tests;
