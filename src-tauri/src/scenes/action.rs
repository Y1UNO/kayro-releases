//! The extension point of the engine: one `Action` per kind of step.

use std::collections::BTreeMap;

use super::clock::{CancelToken, Clock};
use super::Reason;
use crate::config::apps::AppEntry;
use crate::launcher::Launcher;
use crate::procwatch::RunningApps;

/// Everything a step may touch. Built once per run.
pub struct Env<'a> {
    pub launcher: &'a dyn Launcher,
    pub running: &'a dyn RunningApps,
    pub clock: &'a dyn Clock,
    pub cancel: &'a CancelToken,
    pub apps: &'a [AppEntry],
    /// Slot name → app id.
    pub slots: &'a BTreeMap<String, String>,
    /// The user confirmed (in the interface) that this run may close apps.
    pub close_confirmed: bool,
}

impl Env<'_> {
    /// The app a slot is linked to; `None` when unlinked or when the app no longer exists.
    pub fn resolve(&self, slot: &str) -> Option<&AppEntry> {
        let id = self.slots.get(slot)?;
        self.apps.iter().find(|a| &a.id == id)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepOutcome {
    Done,
    Failed(Reason),
    Skipped(Reason),
    /// The run was cancelled while the step was in progress.
    Cancelled,
}

pub trait Action {
    /// Slot the step works on. The engine resolves it first and skips the step as
    /// `SlotUnlinked` when it leads nowhere, so `run` receives the app.
    fn slot(&self) -> Option<&str>;
    fn run(&self, env: &Env, app: Option<&AppEntry>) -> StepOutcome;
}
