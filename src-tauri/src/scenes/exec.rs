//! Runs one scene: the state machine of every step, the abort rules, the progress events and
//! the execution log.
//!
//! Step states: `Pending → Running → Ok | Failed | Skipped`. A failure only stops the scene
//! when the step is `required`; cancelling ends the current wait at once and skips the rest.

use std::time::Instant;

use super::action::{Env, StepOutcome};
use super::actions::build;
use super::{ProgressEvent, ProgressUpdate, Reason, RunStatus, StepState};
use crate::config::scene::SceneFile;

/// Final result of one step.
pub type StepResult = (StepState, Option<Reason>);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunSummary {
    pub status: RunStatus,
    pub steps: Vec<StepResult>,
}

/// Plays `scene` on the calling thread, reporting every change through `emit`.
pub fn execute(
    scene: &SceneFile,
    run_id: u32,
    env: &Env,
    emit: &dyn Fn(ProgressEvent),
) -> RunSummary {
    let started = Instant::now();
    let send = |update| {
        emit(ProgressEvent {
            run_id,
            scene_id: scene.id.clone(),
            update,
        });
    };
    let index = |i: usize| u32::try_from(i).unwrap_or(u32::MAX);
    tracing::info!(scene = %scene.id, run_id, steps = scene.steps.len(), "scene started");
    send(ProgressUpdate::Started {
        total: index(scene.steps.len()),
    });

    let mut results: Vec<StepResult> = Vec::with_capacity(scene.steps.len());
    let (mut cancelled, mut aborted) = (false, false);

    for (i, step) in scene.steps.iter().enumerate() {
        let step_started = Instant::now();
        let result: StepResult = if cancelled || env.cancel.is_cancelled() {
            cancelled = true;
            (StepState::Skipped, Some(Reason::Cancelled))
        } else if aborted {
            (StepState::Skipped, Some(Reason::Aborted))
        } else {
            send(ProgressUpdate::Step {
                index: index(i),
                state: StepState::Running,
                reason: None,
            });
            let action = build(step);
            let app = action.slot().map(|slot| env.resolve(slot));
            let outcome = match app {
                Some(None) => StepOutcome::Skipped(Reason::SlotUnlinked),
                Some(Some(app)) => action.run(env, Some(app)),
                None => action.run(env, None),
            };
            match outcome {
                StepOutcome::Done => (StepState::Ok, None),
                StepOutcome::Skipped(reason) => (StepState::Skipped, Some(reason)),
                StepOutcome::Failed(reason) => {
                    aborted = step.required();
                    (StepState::Failed, Some(reason))
                }
                StepOutcome::Cancelled => {
                    cancelled = true;
                    (StepState::Skipped, Some(Reason::Cancelled))
                }
            }
        };
        tracing::info!(
            scene = %scene.id, run_id, step = i + 1, kind = step.kind(),
            state = ?result.0, reason = ?result.1,
            elapsed_ms = step_started.elapsed().as_millis() as u64,
            "scene step"
        );
        send(ProgressUpdate::Step {
            index: index(i),
            state: result.0,
            reason: result.1,
        });
        results.push(result);
    }

    let status = if cancelled {
        RunStatus::Cancelled
    } else if aborted {
        RunStatus::Failed
    } else {
        RunStatus::Completed
    };
    tracing::info!(
        scene = %scene.id, run_id, ?status,
        elapsed_ms = started.elapsed().as_millis() as u64,
        "scene finished"
    );
    send(ProgressUpdate::Finished { status });
    RunSummary {
        status,
        steps: results,
    }
}
