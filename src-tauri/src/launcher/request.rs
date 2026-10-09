//! What the launcher is asked to start, built only from a stored and valid app entry.

use crate::config::apps::{AppEntry, Launch};
use crate::config::validate::validate_app;

use super::LaunchError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LaunchRequest {
    /// A program, started directly. `elevated` comes from the app's own configuration and is
    /// the only way the hub ever asks for administrator rights.
    Exe {
        path: String,
        args: Vec<String>,
        cwd: Option<String>,
        elevated: bool,
    },
    /// A shortcut (`.lnk`), a protocol link (`steam://…`) or a web address: handed to the shell.
    Shell { target: String },
    /// A packaged (Store) app, by AUMID.
    Uwp { aumid: String },
}

impl LaunchRequest {
    pub fn from_entry(entry: &AppEntry) -> Result<Self, LaunchError> {
        validate_app(entry).map_err(|e| LaunchError::Invalid(e.to_string()))?;
        Ok(match &entry.launch {
            Launch::Exe {
                path,
                args,
                cwd,
                elevated,
            } => Self::Exe {
                path: path.clone(),
                args: args.clone(),
                cwd: cwd.clone(),
                elevated: *elevated,
            },
            Launch::Lnk { path } => Self::Shell {
                target: path.clone(),
            },
            Launch::Uri { uri } => Self::Shell {
                target: uri.clone(),
            },
            Launch::Url { url } => Self::Shell {
                target: url.clone(),
            },
            Launch::Uwp { aumid } => Self::Uwp {
                aumid: aumid.clone(),
            },
        })
    }
}
