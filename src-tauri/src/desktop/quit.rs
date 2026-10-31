//! « Quitter » (the notification area's menu, `Kayro.exe --quit`), review A12.
//!
//! `app.exit` does not end the process: it leaves a request in the event loop's queue, read only
//! by the loop itself once it is idle. A main thread held in a nested message loop never reads it
//! (seen on 2026-10-13: two « asked to quit », the window still there). So a guard thread ends the
//! process itself after `GRACE`, as Tauri does when its request cannot be sent. Whichever way the
//! process ends, the writes already started finish first, no other starts, and the log is
//! written out: no file is ever cut half-way.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Runtime};

use super::windows;
use super::{save_placement, settings};
use crate::config::atomic::WRITES;

/// How long the event loop has to end by itself after « Quitter ».
const GRACE: Duration = Duration::from_secs(3);
/// How long the writes already started may still take.
const WRITE_LIMIT: Duration = Duration::from_secs(2);

/// The process is ending: only one of the two ways goes on.
static LEAVING: AtomicBool = AtomicBool::new(false);

/// True for the first caller only.
fn begin_leaving(flag: &AtomicBool) -> bool {
    !flag.swap(true, Ordering::SeqCst)
}

/// « Quitter »: remembers the placement, asks the event loop to end, and ends the process after
/// `GRACE` if the loop did not.
pub fn quit<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = windows::visible(app) {
        save_placement(app, &w, settings(app).display_mode);
    }
    tracing::info!("quit: asking the event loop to end");
    app.exit(0);
    let app = app.clone();
    let guard = std::thread::Builder::new()
        .name("quit-guard".into())
        .spawn(move || {
            std::thread::sleep(GRACE);
            if !begin_leaving(&LEAVING) {
                return; // the event loop is ending the process
            }
            tracing::warn!(
                after_ms = GRACE.as_millis() as u64,
                "quit: the event loop did not end, leaving directly"
            );
            close_files();
            app.cleanup_before_exit();
            std::process::exit(0);
        });
    if let Err(e) = guard {
        tracing::warn!(error = %e, "quit: no guard thread");
    }
}

/// `RunEvent::Exit` (the loop ended: « Quitter », Windows shutting down): the process ends right
/// after this returns.
pub fn on_exit() {
    if !begin_leaving(&LEAVING) {
        // The guard thread is already ending the process: let it finish.
        loop {
            std::thread::park();
        }
    }
    tracing::info!("exit: the event loop ended");
    close_files();
}

/// The writes already started end (up to `WRITE_LIMIT`), no other starts, the log is written out.
fn close_files() {
    if !WRITES.close(WRITE_LIMIT) {
        tracing::warn!(
            limit_ms = WRITE_LIMIT.as_millis() as u64,
            "a write was still running: its file keeps its old content"
        );
    }
    crate::logging::flush();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_way_ends_the_process() {
        let flag = AtomicBool::new(false);
        assert!(begin_leaving(&flag));
        assert!(!begin_leaving(&flag));
        assert!(!begin_leaving(&flag));
    }
}
