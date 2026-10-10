//! Time, behind a trait: the real clock sleeps on a condition variable that cancelling wakes up
//! at once; the test clock jumps forward instantly.

use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

/// Shared flag to stop a run. Cloning gives another handle to the same flag.
#[derive(Clone, Default)]
pub struct CancelToken(Arc<(Mutex<bool>, Condvar)>);

impl CancelToken {
    pub fn cancel(&self) {
        let (flag, wake) = &*self.0;
        *flag.lock().unwrap_or_else(|p| p.into_inner()) = true;
        wake.notify_all();
    }

    pub fn is_cancelled(&self) -> bool {
        *self.0 .0.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// Sleeps up to `d`; returns early (and false) as soon as the token is cancelled.
    pub fn sleep(&self, d: Duration) -> bool {
        let (flag, wake) = &*self.0;
        let guard = flag.lock().unwrap_or_else(|p| p.into_inner());
        let (guard, _) = wake
            .wait_timeout_while(guard, d, |cancelled| !*cancelled)
            .unwrap_or_else(|p| p.into_inner());
        !*guard
    }
}

pub trait Clock: Send + Sync {
    /// Time elapsed since the clock started.
    fn now(&self) -> Duration;
    /// Waits `d`. Returns false when the token was cancelled (before or during the wait).
    fn sleep(&self, d: Duration, cancel: &CancelToken) -> bool;
}

pub struct RealClock {
    start: Instant,
}

impl RealClock {
    pub fn new() -> Self {
        Self {
            start: Instant::now(),
        }
    }
}

impl Default for RealClock {
    fn default() -> Self {
        Self::new()
    }
}

impl Clock for RealClock {
    fn now(&self) -> Duration {
        self.start.elapsed()
    }

    fn sleep(&self, d: Duration, cancel: &CancelToken) -> bool {
        cancel.sleep(d)
    }
}
