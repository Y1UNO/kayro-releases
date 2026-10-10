//! The five built-in actions, and the mapping from a stored [`Step`] to its action.

use std::time::Duration;

use super::action::{Action, Env, StepOutcome};
use super::Reason;
use crate::config::apps::AppEntry;
use crate::config::scene::Step;
use crate::launcher::{launch_app, LaunchError};

/// How often `waitReady` looks at the process list (which the watcher refreshes on its own).
const POLL: Duration = Duration::from_millis(250);

pub fn build(step: &Step) -> Box<dyn Action + '_> {
    match step {
        Step::Launch { slot, .. } => Box::new(Launch { slot }),
        Step::Wait { ms, .. } => Box::new(Wait { ms: *ms }),
        Step::WaitReady {
            slot, timeout_ms, ..
        } => Box::new(WaitReady {
            slot,
            timeout: Duration::from_millis(u64::from(*timeout_ms)),
        }),
        Step::Focus { slot, .. } => Box::new(Focus { slot }),
        Step::Close { slot, .. } => Box::new(Close { slot }),
    }
}

fn launch_reason(error: &LaunchError) -> Reason {
    match error {
        LaunchError::NotFound => Reason::LaunchNotFound,
        LaunchError::AccessDenied => Reason::LaunchDenied,
        LaunchError::ElevationRequired => Reason::ElevationRequired,
        LaunchError::ElevationCancelled => Reason::ElevationCancelled,
        LaunchError::Invalid(_) | LaunchError::Other(_) => Reason::LaunchFailed,
    }
}

struct Launch<'a> {
    slot: &'a str,
}

impl Action for Launch<'_> {
    fn slot(&self) -> Option<&str> {
        Some(self.slot)
    }

    /// Same path as a click on a card: an app already open is brought to the front instead.
    fn run(&self, env: &Env, app: Option<&AppEntry>) -> StepOutcome {
        let Some(app) = app else {
            return StepOutcome::Skipped(Reason::SlotUnlinked);
        };
        match launch_app(env.launcher, env.running, app) {
            Ok(_) => StepOutcome::Done,
            Err(e) => StepOutcome::Failed(launch_reason(&e)),
        }
    }
}

struct Wait {
    ms: u32,
}

impl Action for Wait {
    fn slot(&self) -> Option<&str> {
        None
    }

    fn run(&self, env: &Env, _app: Option<&AppEntry>) -> StepOutcome {
        let d = Duration::from_millis(u64::from(self.ms));
        if env.clock.sleep(d, env.cancel) {
            StepOutcome::Done
        } else {
            StepOutcome::Cancelled
        }
    }
}

struct WaitReady<'a> {
    slot: &'a str,
    timeout: Duration,
}

impl Action for WaitReady<'_> {
    fn slot(&self) -> Option<&str> {
        Some(self.slot)
    }

    /// Ready = a process of the app exists. An app that cannot be followed is skipped at once
    /// rather than waited for until the timeout.
    fn run(&self, env: &Env, app: Option<&AppEntry>) -> StepOutcome {
        let Some(app) = app else {
            return StepOutcome::Skipped(Reason::SlotUnlinked);
        };
        if !env.running.is_followed(&app.id) {
            return StepOutcome::Skipped(Reason::NotFollowable);
        }
        // Keep the watcher on its quick pace for the whole wait.
        env.running.note_launch();
        let deadline = env.clock.now() + self.timeout;
        loop {
            if !env.running.pids_of(&app.id).is_empty() {
                return StepOutcome::Done;
            }
            let left = deadline.saturating_sub(env.clock.now());
            if left.is_zero() {
                return StepOutcome::Failed(Reason::Timeout);
            }
            if !env.clock.sleep(left.min(POLL), env.cancel) {
                return StepOutcome::Cancelled;
            }
        }
    }
}

struct Focus<'a> {
    slot: &'a str,
}

impl Action for Focus<'_> {
    fn slot(&self) -> Option<&str> {
        Some(self.slot)
    }

    fn run(&self, env: &Env, app: Option<&AppEntry>) -> StepOutcome {
        let Some(app) = app else {
            return StepOutcome::Skipped(Reason::SlotUnlinked);
        };
        if !env.running.is_followed(&app.id) {
            return StepOutcome::Skipped(Reason::NotFollowable);
        }
        let pids = env.running.pids_of(&app.id);
        if pids.is_empty() {
            StepOutcome::Failed(Reason::NotRunning)
        } else if env.running.bring_to_front(&pids) {
            StepOutcome::Done
        } else {
            StepOutcome::Failed(Reason::FocusFailed)
        }
    }
}

struct Close<'a> {
    slot: &'a str,
}

impl Action for Close<'_> {
    fn slot(&self) -> Option<&str> {
        Some(self.slot)
    }

    /// Soft close only (a close message to the window); nothing is ever killed. Refused unless
    /// the interface asked the user first. Does not wait for the app to exit: it may be asking
    /// to save something.
    fn run(&self, env: &Env, app: Option<&AppEntry>) -> StepOutcome {
        if !env.close_confirmed {
            return StepOutcome::Failed(Reason::ConfirmationRequired);
        }
        let Some(app) = app else {
            return StepOutcome::Skipped(Reason::SlotUnlinked);
        };
        if !env.running.is_followed(&app.id) {
            return StepOutcome::Skipped(Reason::NotFollowable);
        }
        let pids = env.running.pids_of(&app.id);
        if pids.is_empty() {
            return StepOutcome::Skipped(Reason::NotRunning);
        }
        if env.running.close_softly(&pids) {
            StepOutcome::Done
        } else {
            StepOutcome::Failed(Reason::CloseFailed)
        }
    }
}
