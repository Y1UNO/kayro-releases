use std::sync::{Mutex, PoisonError};

use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::EnvFilter;

use crate::paths::logs_dir;

/// Keeps the writer's buffered lines alive for the whole run; dropped by `flush` at the very end
/// (the process ends with `std::process::exit`, which runs no destructor).
static GUARD: Mutex<Option<WorkerGuard>> = Mutex::new(None);

/// Initialises `tracing` with a daily rolling file in `%APPDATA%/Kayro/logs` (7 files kept).
pub fn init() {
    if let Some(guard) = writer_guard() {
        *GUARD.lock().unwrap_or_else(PoisonError::into_inner) = Some(guard);
    }
}

fn writer_guard() -> Option<WorkerGuard> {
    std::fs::create_dir_all(logs_dir()).ok()?;
    let appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("kayro")
        .filename_suffix("log")
        .max_log_files(7)
        .build(logs_dir())
        .ok()?;
    let (writer, guard) = tracing_appender::non_blocking(appender);
    tracing_subscriber::fmt()
        .with_writer(writer)
        .with_ansi(false)
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();
    Some(guard)
}

/// Writes out the buffered lines, just before the process ends; later lines are dropped.
pub fn flush() {
    let guard = GUARD.lock().unwrap_or_else(PoisonError::into_inner).take();
    drop(guard);
}
