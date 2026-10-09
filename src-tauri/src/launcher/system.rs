//! The real launcher: Win32 calls from `platform`.

use crate::platform::{com, shell};

use super::request::LaunchRequest;
use super::{LaunchError, LaunchOutcome, Launcher};

#[derive(Debug, Default)]
pub struct SystemLauncher;

impl Launcher for SystemLauncher {
    fn launch(&self, request: &LaunchRequest) -> Result<LaunchOutcome, LaunchError> {
        let pid = match request {
            // Not configured as elevated: started directly, so a program that insists on
            // administrator rights fails with `ElevationRequired` instead of raising a prompt
            // nobody asked for.
            LaunchRequest::Exe {
                path,
                args,
                cwd,
                elevated: false,
            } => Some(shell::create_process(path, args, cwd.as_deref())?),
            LaunchRequest::Exe {
                path,
                args,
                cwd,
                elevated: true,
            } => shell::shell_execute(path, args, cwd.as_deref(), Some("runas"))?,
            // Shortcuts may point at a program that elevates itself: Windows decides there.
            LaunchRequest::Shell { target } => shell::shell_execute(target, &[], None, None)?,
            LaunchRequest::Uwp { aumid } => Some(com::activate_uwp(aumid)?),
        };
        Ok(LaunchOutcome { pid })
    }
}

impl From<crate::platform::Win32Error> for LaunchError {
    fn from(e: crate::platform::Win32Error) -> Self {
        Self::classify(e)
    }
}
