//! Settings that act on the windows: the display mode (with its passage, round 4b), the
//! economy mode and « Kysland toujours à l'écran ».

use tauri::{AppHandle, Manager, PhysicalSize, Runtime, WebviewWindow};

use super::passage;
use super::windows::{self, MAIN};
use super::{create_for, save_placement, settings, tray, DesktopState};
use crate::config::schema::{DisplayMode, Settings};
use crate::config::ui_state::Rect;
use crate::config::ConfigState;

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
    if old.island_always != new.island_always {
        super::island::sync(app);
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

/// Immersive ⇄ window: the same window. On screen, its page fades out first, the window changes
/// while nothing shows, then the page comes back (round 4b).
fn mode_changed<R: Runtime>(app: &AppHandle<R>, old: DisplayMode, new: DisplayMode) {
    let Some(window) = windows::get(app, MAIN) else {
        return;
    };
    save_placement(app, &window, old);
    if !window.is_visible().unwrap_or(false) {
        let _ = reconfigure_main(app, &window, new);
        return;
    }
    passage::fade_out_then(app, MAIN, |app, id, _veil| {
        // The latest mode wins (another change may have come in the meantime).
        let now = settings(&app).display_mode;
        let resized = windows::get(&app, MAIN)
            .map(|window| reconfigure_main(&app, &window, now))
            .unwrap_or(true);
        passage::fade_in(&app, id, MAIN, resized);
    });
}

/// Economy mode on while Kayro is hidden: its window goes (the island stays, it is on screen).
fn economy_changed<R: Runtime>(app: &AppHandle<R>, now: &Settings) {
    let shown = windows::visible(app).is_some();
    if now.economy_mode && !shown {
        if let Some(w) = windows::get(app, MAIN) {
            let _ = w.destroy();
        }
    } else if !now.economy_mode && windows::get(app, MAIN).is_none() {
        if let Err(e) = create_for(app, now.display_mode, false) {
            tracing::error!(error = %e, "could not create the window");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use DisplayMode::{Immersive, Window};

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
