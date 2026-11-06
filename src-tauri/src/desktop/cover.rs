//! Launch cover (30/10): while a game starts behind it, the hub stays in front of everything
//! (topmost), so the store's own windows (Steam's « préparation du lancement »…) never show over
//! the launch sequence. The game is « up » when a **new, large** window of another program shows
//! (not the hub's, not a store launcher's, at least `MIN_SHARE` of its monitor, absent when the
//! cover started: a splash screen or a small launcher does not count). It is reported once
//! (`LaunchLanded`); the page then ends its sequence, the cover drops, the hub hides and the
//! game's window is brought to the front.
//!
//! A watcher looks four times a second, only while a cover is on. The page always ends the cover
//! itself (its sequence has a ceiling of 10 s); a cover left behind is stale after `CEILING`.

use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime};

use crate::platform::top_windows::{top_windows, TopWindow};
use crate::platform::{process, window};

/// A cover older than this is stale: it no longer keeps the hub in front.
const CEILING: Duration = Duration::from_secs(15);
const EVERY: Duration = Duration::from_millis(250);
/// The game's window covers at least this share of its monitor (a splash screen does not).
pub const MIN_SHARE: f32 = 0.2;

/// Programs that are not the game: store launchers and their helpers, the shell itself.
const NOT_THE_GAME: &[&str] = &[
    "steam.exe",
    "steamwebhelper.exe",
    "steamservice.exe",
    "steamerrorreporter.exe",
    "gameoverlayui.exe",
    "epicgameslauncher.exe",
    "epicwebhelper.exe",
    "battle.net.exe",
    "agent.exe",
    "galaxyclient.exe",
    "galaxyclient helper.exe",
    "eadesktop.exe",
    "eabackgroundservice.exe",
    "origin.exe",
    "upc.exe",
    "ubisoftconnect.exe",
    "riotclientservices.exe",
    "riotclientux.exe",
    "riotclientuxrender.exe",
    "explorer.exe",
    "searchhost.exe",
    "shellexperiencehost.exe",
    "startmenuexperiencehost.exe",
    "applicationframehost.exe",
    "textinputhost.exe",
    "msedgewebview2.exe",
    "crashreportclient.exe",
];

/// The game's window came up (file name of its program), during a cover.
#[derive(Debug, Clone, Serialize, Deserialize, Type, tauri_specta::Event)]
pub struct LaunchLanded(pub String);

struct Armed {
    since: Instant,
    /// The windows already there when the cover started.
    before: HashSet<isize>,
    /// The game's process, once its window is up.
    landed: Option<u32>,
}

static ARMED: Mutex<Option<Armed>> = Mutex::new(None);
static REPORT: OnceLock<Box<dyn Fn(String) + Send + Sync>> = OnceLock::new();

fn armed() -> std::sync::MutexGuard<'static, Option<Armed>> {
    ARMED.lock().unwrap_or_else(|p| p.into_inner())
}

/// Where `LaunchLanded` goes (set once at start-up).
pub fn set_reporter(report: impl Fn(String) + Send + Sync + 'static) {
    let _ = REPORT.set(Box::new(report));
}

/// A cover is under way (and not stale): the hub keeps the front even without the focus.
pub fn covering() -> bool {
    armed()
        .as_ref()
        .is_some_and(|a| a.since.elapsed() < CEILING)
}

/// Pure rule: the first window (front to back) that is the game's — new since the cover started,
/// large, not the hub's, not a launcher's. `exe_of` names a process.
pub fn landing(
    windows: &[TopWindow],
    before: &HashSet<isize>,
    own: u32,
    exe_of: impl Fn(u32) -> Option<String>,
) -> Option<(u32, String)> {
    windows
        .iter()
        .filter(|w| w.pid != own && w.share >= MIN_SHARE && !before.contains(&w.hwnd))
        .find_map(|w| {
            let exe = exe_of(w.pid)?;
            (!NOT_THE_GAME.contains(&exe.as_str())).then_some((w.pid, exe))
        })
}

/// Looks for the game's window now; reports it the first time.
fn check() {
    let windows = top_windows();
    let mut guard = armed();
    let Some(a) = guard.as_mut().filter(|a| a.landed.is_none()) else {
        return;
    };
    let Some((pid, exe)) = landing(&windows, &a.before, std::process::id(), process::exe_name)
    else {
        return;
    };
    a.landed = Some(pid);
    drop(guard);
    tracing::info!(%exe, "launch cover: the game's window is up");
    if let Some(report) = REPORT.get() {
        report(exe);
    }
}

/// From the foreground hook: something came to the front, perhaps the game (look at once).
pub fn on_foreground(_pid: u32) {
    if covering() {
        check();
    }
}

/// Starts a cover: the hub in front of everything, any program allowed to take the focus, the
/// watcher looking for the game's window.
pub fn start<R: Runtime>(app: &AppHandle<R>) {
    let before = top_windows().into_iter().map(|w| w.hwnd).collect();
    *armed() = Some(Armed {
        since: Instant::now(),
        before,
        landed: None,
    });
    process::allow_any_foreground();
    if let Some(window) = app.get_webview_window(super::MAIN) {
        let _ = window.set_always_on_top(true);
    }
    let spawned = std::thread::Builder::new()
        .name("launch-cover".into())
        .spawn(|| {
            while covering() && armed().as_ref().is_some_and(|a| a.landed.is_none()) {
                std::thread::sleep(EVERY);
                check();
            }
        });
    if let Err(e) = spawned {
        tracing::warn!(error = %e, "launch cover: no watcher (the page's ceiling still ends it)");
    }
    tracing::info!("launch cover on");
}

/// Ends the cover; `hide`: the hub leaves the screen and the game's window comes to the front.
pub fn end<R: Runtime>(app: &AppHandle<R>, hide: bool) {
    let Some(a) = armed().take() else {
        return;
    };
    if let Some(window) = app.get_webview_window(super::MAIN) {
        let focused = window.is_focused().unwrap_or(false);
        let immersive =
            super::settings(app).display_mode == crate::config::schema::DisplayMode::Immersive;
        let _ = window.set_always_on_top(immersive && focused && !hide);
    }
    if !hide {
        tracing::info!("launch cover off");
        return;
    }
    super::hide(app);
    // The game's window (found now if the watcher had not seen it yet) takes the front.
    let game = a.landed.or_else(|| {
        landing(
            &top_windows(),
            &a.before,
            std::process::id(),
            process::exe_name,
        )
        .map(|g| g.0)
    });
    let fronted = game.is_some_and(|pid| window::bring_to_front(&[pid]));
    tracing::info!(game = ?game, fronted, "launch cover off, hub hidden");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn win(hwnd: isize, pid: u32, share: f32) -> TopWindow {
        TopWindow { hwnd, pid, share }
    }

    fn exe(pid: u32) -> Option<String> {
        Some(
            match pid {
                1 => "kayro.exe",
                2 => "steam.exe",
                3 => "sandfall-win64-shipping.exe",
                4 => "chrome.exe",
                _ => return None,
            }
            .into(),
        )
    }

    #[test]
    fn only_a_new_large_window_of_the_game_counts() {
        let before: HashSet<isize> = [40].into();
        // Steam's dialog, a splash screen, the hub, a window already there: none is the game.
        let early = [
            win(10, 2, 0.9),
            win(11, 3, 0.05),
            win(12, 1, 1.0),
            win(40, 4, 1.0),
        ];
        assert_eq!(landing(&early, &before, 1, exe), None);
        // The game's real window shows.
        let up = [win(20, 3, 0.6), win(10, 2, 0.9)];
        assert_eq!(
            landing(&up, &before, 1, exe),
            Some((3, "sandfall-win64-shipping.exe".into()))
        );
        // A program Windows will not name is skipped, not taken.
        assert_eq!(landing(&[win(30, 9, 1.0)], &before, 1, exe), None);
    }

    #[test]
    fn nothing_happens_without_a_cover() {
        *armed() = None;
        assert!(!covering());
        on_foreground(4);
        assert!(armed().is_none());
    }
}
