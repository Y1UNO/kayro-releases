//! Settings that act on the windows: the display mode (with its passage, round 4b) and the
//! economy mode.

use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, PhysicalSize, Runtime, WebviewWindow};

use super::passage;
use super::veil_play;
use super::windows::{self, MAIN, WIDGET};
use super::{create_for, lock, reveal, save_placement, settings, tray, DesktopState};
use crate::config::schema::{DisplayMode, Settings};
use crate::config::ui_state::Rect;
use crate::config::ConfigState;

/// A passage that builds a window and still has not shown it after this long is given up: a
/// mode change goes through again (its page never painted).
const IN_FLIGHT_LIMIT: Duration = Duration::from_secs(5);

/// A passage that builds the other window (to or from the widget), from the request until the
/// new window is on screen. A mode change meanwhile could not build its own window (one is being
/// built, the other still shows): it is kept, then applied once the passage ends (review A2).
#[derive(Debug, Default)]
pub struct ModeGate {
    /// Start of the passage in flight, and whether a change came meanwhile.
    flight: Option<(Instant, bool)>,
}

impl ModeGate {
    pub fn begin(&mut self, now: Instant) {
        self.flight = Some((now, false));
    }

    /// The passage could not start (its window could not be built).
    pub fn cancel(&mut self) {
        self.flight = None;
    }

    /// A mode change arrives: true = kept for the end of the passage in flight.
    pub fn defer(&mut self, now: Instant) -> bool {
        match &mut self.flight {
            Some((since, kept)) if now.duration_since(*since) < IN_FLIGHT_LIMIT => {
                *kept = true;
                true
            }
            Some(_) => {
                tracing::warn!("passage given up: its window never showed");
                self.flight = None;
                false
            }
            None => false,
        }
    }

    /// A window is on screen: the passage in flight (if any) is over. True when a change was kept.
    pub fn end(&mut self) -> bool {
        self.flight.take().is_some_and(|(_, kept)| kept)
    }
}

/// The change still to make once a passage ended: from the mode on screen to the settings' one.
fn change_to_apply(
    kept: bool,
    shown: DisplayMode,
    wanted: DisplayMode,
) -> Option<(DisplayMode, DisplayMode)> {
    (kept && shown != wanted).then_some((shown, wanted))
}

/// The mode a window shows: the widget, or `main` with a frame (window) or without (immersive).
fn mode_of<R: Runtime>(window: &WebviewWindow<R>) -> DisplayMode {
    if window.label() == WIDGET {
        DisplayMode::Widget
    } else if window.is_decorated().unwrap_or(false) {
        DisplayMode::Window
    } else {
        DisplayMode::Immersive
    }
}

/// `window` is on screen (`reveal`): a mode change kept during the passage that built it is
/// applied now, on its own thread (it may build a window).
pub(super) fn passage_ended<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let kept = lock(&app.state::<DesktopState>().mode_gate).end();
    if !kept {
        return;
    }
    let wanted = settings(app).display_mode;
    if let Some((old, new)) = change_to_apply(kept, mode_of(window), wanted) {
        tracing::info!("mode change kept during the passage: applied now");
        let app = app.clone();
        std::thread::spawn(move || mode_changed(&app, old, new));
    }
}

/// Whether giving `main` the inner size of `rect` for `mode` changes what its page lays out
/// (its size, or its frame and zoom). True when unsure.
fn layout_changes(
    size: Option<PhysicalSize<u32>>,
    framed: Option<bool>,
    mode: DisplayMode,
    rect: Rect,
) -> bool {
    let (Some(size), Some(framed)) = (size, framed) else {
        return true;
    };
    framed != (mode == DisplayMode::Window)
        || size.width != rect.width
        || size.height != rect.height
}

/// Applies what changed between two settings: the display mode, the economy mode, the menu.
pub fn settings_changed<R: Runtime>(app: &AppHandle<R>, old: &Settings, new: &Settings) {
    if old.display_mode != new.display_mode {
        // Step 19: the express start's window is immersive whatever the setting said.
        let shown = if app.state::<DesktopState>().end_express_immersive() {
            DisplayMode::Immersive
        } else {
            old.display_mode
        };
        if shown != new.display_mode {
            mode_changed(app, shown, new.display_mode);
        }
    }
    if old.economy_mode != new.economy_mode {
        economy_changed(app, new);
    }
    if old.display_mode != new.display_mode {
        tray::rebuild_menu(app);
    }
}

/// Immersive ⇄ window on the same window: its place, size, frame and zoom. True when what its
/// page lays out changes (see `layout_changes`).
fn reconfigure_main<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    mode: DisplayMode,
) -> bool {
    let screens = windows::screens(app);
    if screens.is_empty() {
        return true;
    }
    let (size, framed) = (window.inner_size().ok(), window.is_decorated().ok());
    let ui = app.state::<ConfigState>().ui_state();
    let saved = if mode == DisplayMode::Immersive {
        &ui.immersive
    } else {
        &ui.window
    };
    let i = windows::choose_screen(app, &screens, saved, Some(window));
    let rect = windows::configure_main(window, mode, &screens[i], &ui.window);
    if mode == DisplayMode::Immersive && window.is_focused().unwrap_or(false) {
        let _ = window.set_always_on_top(true);
    }
    layout_changes(size, framed, mode, rect)
}

fn mode_changed<R: Runtime>(app: &AppHandle<R>, old: DisplayMode, new: DisplayMode) {
    let state = app.state::<DesktopState>();
    // A passage is building a window: this change waits for its end (`passage_ended`).
    if lock(&state.mode_gate).defer(Instant::now()) {
        tracing::info!("mode change kept for the end of the passage in flight");
        return;
    }
    let old_label = windows::label_for(old);
    let old_window = windows::get(app, old_label);
    if let Some(w) = &old_window {
        save_placement(app, w, old);
    }
    if old_label == windows::label_for(new) {
        // Immersive ⇄ window: the same window. On screen, its page fades out first, the window
        // changes while nothing shows, then the page comes back (round 4b).
        let Some(window) = old_window else { return };
        if !window.is_visible().unwrap_or(false) {
            let _ = reconfigure_main(app, &window, new);
            return;
        }
        passage::fade_out_then(app, MAIN, |app, id, _veil| {
            // The latest mode wins (another change may have come in the meantime).
            let now = settings(&app).display_mode;
            if windows::label_for(now) != MAIN {
                return;
            }
            let resized = windows::get(&app, MAIN)
                .map(|window| reconfigure_main(&app, &window, now))
                .unwrap_or(true);
            passage::fade_in(&app, id, MAIN, resized);
        });
        return;
    }
    // The widget is involved: another window, built hidden for a passage (its page enters on its
    // first show), then swapped in once painted (`page_ready` → `swap_after_fade`).
    let shown = windows::visible(app).is_some();
    if shown {
        *lock(&state.retire) = Some(old_label);
        state.want_visible.store(true, Ordering::SeqCst);
        lock(&state.mode_gate).begin(Instant::now());
        if let Err(e) = create_for(app, new, true) {
            tracing::error!(error = %e, "could not create the window");
            *lock(&state.retire) = None;
            state.want_visible.store(false, Ordering::SeqCst);
            lock(&state.mode_gate).cancel();
        }
    } else {
        if let Some(w) = old_window {
            let _ = w.destroy();
        }
        if !settings(app).economy_mode {
            if let Err(e) = create_for(app, new, false) {
                tracing::error!(error = %e, "could not create the window");
            }
        }
    }
}

/// The new window of a passage has painted (hidden). When the window it replaces is on screen,
/// that one fades out first; then the new one is shown (and the old one retired by `reveal`).
/// `main` is opaque: a native veil of its dark colour fades it into the desktop, or darkens its
/// place before it shows (option A, see `veil_play`); no veil when the change is direct.
/// False when there is nothing to fade (the caller reveals at once).
pub(super) fn swap_after_fade<R: Runtime>(app: &AppHandle<R>, new_label: &str) -> bool {
    let Some(old_label) = *lock(&app.state::<DesktopState>().retire) else {
        return false;
    };
    let old_shown = windows::get(app, old_label)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if !old_shown {
        return false;
    }
    let new_label = if new_label == WIDGET { WIDGET } else { MAIN };
    passage::fade_out_then(app, old_label, move |app, _, veil| {
        let Some(window) = windows::get(&app, new_label) else {
            return;
        };
        let swap = || reveal(&app, &window);
        let Some(fade) = veil else { return swap() };
        if new_label == WIDGET {
            let place = windows::get(&app, MAIN).and_then(|w| veil_play::place_of(&w));
            veil_play::cover_then_clear(&app, place, &fade, swap);
        } else {
            let place = veil_play::place_of(&window);
            veil_play::darken_then_lift(&app, place, &fade, swap);
        }
    });
    true
}

fn economy_changed<R: Runtime>(app: &AppHandle<R>, now: &Settings) {
    let shown = windows::visible(app).is_some();
    if now.economy_mode && !shown {
        for label in [MAIN, WIDGET] {
            if let Some(w) = windows::get(app, label) {
                let _ = w.destroy();
            }
        }
    } else if !now.economy_mode && windows::get(app, windows::label_for(now.display_mode)).is_none()
    {
        if let Err(e) = create_for(app, now.display_mode, false) {
            tracing::error!(error = %e, "could not create the window");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use DisplayMode::{Immersive, Widget, Window};

    #[test]
    fn a_second_change_during_a_passage_is_kept_then_applied_at_its_end() {
        let t0 = Instant::now();
        let mut gate = ModeGate::default();
        // Immersive → widget: the widget is being built, `main` still shows.
        gate.begin(t0);
        // Widget → window from the notification area meanwhile: kept, nothing built.
        assert!(gate.defer(t0 + Duration::from_millis(150)));
        assert!(gate.defer(t0 + Duration::from_millis(300)));
        // The widget shows: the kept change goes from it to the latest wanted mode, once.
        let kept = gate.end();
        assert_eq!(
            change_to_apply(kept, Widget, Window),
            Some((Widget, Window))
        );
        assert!(!gate.end());
        assert!(!gate.defer(t0 + Duration::from_millis(400)));
    }

    #[test]
    fn nothing_to_apply_when_the_settings_came_back_to_the_mode_shown() {
        let mut gate = ModeGate::default();
        gate.begin(Instant::now());
        assert!(gate.defer(Instant::now()));
        assert_eq!(change_to_apply(gate.end(), Widget, Widget), None);
        // No change came during the passage: nothing either.
        gate.begin(Instant::now());
        assert_eq!(change_to_apply(gate.end(), Widget, Immersive), None);
    }

    #[test]
    fn a_passage_that_failed_or_never_ended_blocks_nothing() {
        let t0 = Instant::now();
        let mut gate = ModeGate::default();
        gate.begin(t0);
        gate.cancel();
        assert!(!gate.defer(t0));
        gate.begin(t0);
        assert!(!gate.defer(t0 + IN_FLIGHT_LIMIT));
        assert!(!gate.end());
    }

    #[test]
    fn the_page_waits_for_a_new_size_only_when_the_layout_changes() {
        let rect = Rect {
            x: 0,
            y: 0,
            width: 2560,
            height: 1440,
        };
        let full = Some(PhysicalSize::new(2560, 1440));
        assert!(!layout_changes(full, Some(false), Immersive, rect));
        // Leaving the frame changes the zoom and the size: wait.
        assert!(layout_changes(full, Some(true), Immersive, rect));
        let small = Some(PhysicalSize::new(1920, 1140));
        assert!(layout_changes(small, Some(true), Window, rect));
        assert!(layout_changes(None, Some(false), Immersive, rect));
    }
}
