//! At most one scene plays at a time, on a thread of its own.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use super::clock::CancelToken;
use crate::error::{AppError, ErrorCode};

struct Active {
    run_id: u32,
    token: CancelToken,
}

#[derive(Default)]
pub struct SceneRunner {
    next_id: AtomicU32,
    active: Arc<Mutex<Option<Active>>>,
}

/// Clears the "a scene is playing" mark however the run thread ends (even by panicking).
struct Release {
    active: Arc<Mutex<Option<Active>>>,
    run_id: u32,
}

impl Drop for Release {
    fn drop(&mut self) {
        let mut guard = self.active.lock().unwrap_or_else(|p| p.into_inner());
        if guard.as_ref().is_some_and(|a| a.run_id == self.run_id) {
            *guard = None;
        }
    }
}

impl SceneRunner {
    /// Starts `job(run_id, token)` on a new thread and returns at once with the run id. Refused
    /// (`Busy`) while another scene is playing.
    pub fn start<F>(&self, job: F) -> Result<u32, AppError>
    where
        F: FnOnce(u32, &CancelToken) + Send + 'static,
    {
        let mut guard = self.active.lock().unwrap_or_else(|p| p.into_inner());
        if guard.is_some() {
            return Err(AppError::new(ErrorCode::Busy, "a scene is already playing"));
        }
        let run_id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let token = CancelToken::default();
        let active = Arc::clone(&self.active);
        let job_token = token.clone();
        std::thread::Builder::new()
            .name(format!("scene-run-{run_id}"))
            .spawn(move || {
                // Built here, not before: dropping it needs the lock `start` is holding.
                let _release = Release { active, run_id };
                job(run_id, &job_token);
            })
            .map_err(|e| AppError::new(ErrorCode::Internal, format!("scene thread: {e}")))?;
        *guard = Some(Active { run_id, token });
        Ok(run_id)
    }

    /// Cancels the scene being played. False when none is.
    pub fn cancel(&self) -> bool {
        let guard = self.active.lock().unwrap_or_else(|p| p.into_inner());
        guard.as_ref().map(|a| a.token.cancel()).is_some()
    }

    pub fn is_playing(&self) -> bool {
        self.active
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .is_some()
    }
}
