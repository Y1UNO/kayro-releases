//! Test double: records what it is asked to start and answers with a programmed result.

use std::sync::Mutex;

use super::request::LaunchRequest;
use super::{LaunchError, LaunchOutcome, Launcher};

pub struct FakeLauncher {
    calls: Mutex<Vec<LaunchRequest>>,
    answer: Mutex<Result<LaunchOutcome, LaunchError>>,
}

impl FakeLauncher {
    pub fn answering(answer: Result<LaunchOutcome, LaunchError>) -> Self {
        Self {
            calls: Mutex::default(),
            answer: Mutex::new(answer),
        }
    }

    pub fn ok(pid: u32) -> Self {
        Self::answering(Ok(LaunchOutcome { pid: Some(pid) }))
    }

    pub fn calls(&self) -> Vec<LaunchRequest> {
        self.calls.lock().unwrap().clone()
    }
}

impl Launcher for FakeLauncher {
    fn launch(&self, request: &LaunchRequest) -> Result<LaunchOutcome, LaunchError> {
        self.calls.lock().unwrap().push(request.clone());
        self.answer.lock().unwrap().clone()
    }
}
