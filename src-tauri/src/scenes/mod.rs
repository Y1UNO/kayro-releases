//! Scene engine: plays the steps of a scene one after the other, on its own thread, and can be
//! cancelled at any moment. The interface only sends commands and shows `ProgressEvent`s.
//!
//! * `action`: the extensible [`action::Action`] trait; `actions`: launch / wait / waitReady /
//!   focus / close. A future integration (OBS, lights…) is a new `Step` variant + a new `Action`.
//! * `clock`: time and cancellable sleeping behind a trait, so tests run on a simulated clock.
//! * `exec`: the state machine that runs a scene.

pub mod action;
pub mod actions;
pub mod clock;
pub mod exec;
pub mod runner;

use serde::{Deserialize, Serialize};
use specta::Type;

pub use runner::SceneRunner;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum StepState {
    Pending,
    Running,
    Ok,
    Failed,
    /// Not run: unlinked slot, nothing to follow, scene cancelled or aborted…
    Skipped,
}

/// Why a step failed or was skipped (the interface picks its own wording).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Reason {
    /// The slot is not linked to an app (or the app was removed).
    SlotUnlinked,
    /// The app has no way to recognise its process, so it can be started but not followed.
    NotFollowable,
    NotRunning,
    Timeout,
    /// A `close` step reached the engine without the user's confirmation.
    ConfirmationRequired,
    /// The scene was cancelled.
    Cancelled,
    /// An earlier `required` step failed.
    Aborted,
    LaunchNotFound,
    LaunchDenied,
    ElevationRequired,
    ElevationCancelled,
    LaunchFailed,
    FocusFailed,
    CloseFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RunStatus {
    /// Every step ran or was skipped without a `required` failure.
    Completed,
    /// A `required` step failed: the rest was not run.
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ProgressUpdate {
    Started {
        total: u32,
    },
    Step {
        index: u32,
        state: StepState,
        reason: Option<Reason>,
    },
    Finished {
        status: RunStatus,
    },
}

/// Payload of the `scene_progress` event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub run_id: u32,
    pub scene_id: String,
    pub update: ProgressUpdate,
}

#[cfg(test)]
mod fixtures;
#[cfg(test)]
mod tests;
