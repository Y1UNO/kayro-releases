use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::EnvFilter;

use crate::paths::logs_dir;

/// Initialises `tracing` with a daily rolling file in `%APPDATA%/Hub/logs` (7 files kept).
/// The returned guard must stay alive for the whole run so buffered lines are flushed.
pub fn init() -> Option<WorkerGuard> {
    std::fs::create_dir_all(logs_dir()).ok()?;
    let appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("hub")
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
