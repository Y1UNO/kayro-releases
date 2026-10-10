//! Notification-area icon: white or black glyph following the Windows theme, sized for the
//! display scale. Left click shows the hub; the menu has Open, Mode, Scenes and Quit.

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};

use crate::config::schema::{DisplayMode, SettingsPatch};
use crate::config::ConfigState;
use crate::platform::theme::taskbar_is_light;

const TRAY_ID: &str = "main";
const MAIN_WINDOW: &str = "main";

// Menu texts live here: the message catalogue (`t()`) is on the interface side.
const OPEN: &str = "Ouvrir";
const MODE: &str = "Mode d'affichage";
const SCENES: &str = "Scènes";
const NO_SCENES: &str = "Aucune scène";
const QUIT: &str = "Quitter";
const MODES: [(DisplayMode, &str, &str); 3] = [
    (DisplayMode::Immersive, "mode:immersive", "Immersif"),
    (DisplayMode::Window, "mode:window", "Fenêtre"),
    (DisplayMode::Widget, "mode:widget", "Widget"),
];

/// Light taskbar → black glyph; dark taskbar → white glyph.
fn png_bytes(light_taskbar: bool, size: u32) -> &'static [u8] {
    macro_rules! pick {
        ($colour:literal) => {
            match size {
                16 => &include_bytes!(concat!("../../icons/tray-", $colour, "-16.png"))[..],
                20 => &include_bytes!(concat!("../../icons/tray-", $colour, "-20.png"))[..],
                24 => &include_bytes!(concat!("../../icons/tray-", $colour, "-24.png"))[..],
                _ => &include_bytes!(concat!("../../icons/tray-", $colour, "-32.png"))[..],
            }
        };
    }
    if light_taskbar {
        pick!("noir")
    } else {
        pick!("blanc")
    }
}

/// Smallest exported size that is at least as sharp as the 16 px logical icon at this scale.
pub(crate) fn size_for_scale(scale: f64) -> u32 {
    match scale {
        s if s <= 1.1 => 16,
        s if s <= 1.35 => 20,
        s if s <= 1.75 => 24,
        _ => 32,
    }
}

fn decode(bytes: &[u8]) -> Option<Image<'static>> {
    let mut reader = png::Decoder::new(std::io::Cursor::new(bytes))
        .read_info()
        .ok()?;
    let mut buf = vec![0; reader.output_buffer_size()?];
    let info = reader.next_frame(&mut buf).ok()?;
    if info.color_type != png::ColorType::Rgba || info.bit_depth != png::BitDepth::Eight {
        return None;
    }
    buf.truncate(info.buffer_size());
    Some(Image::new_owned(buf, info.width, info.height))
}

fn current_icon<R: Runtime>(app: &AppHandle<R>) -> Option<Image<'static>> {
    // Any window will do: the icon follows the display scale, not a particular window.
    let scale = [MAIN_WINDOW, "widget"]
        .iter()
        .find_map(|label| app.get_webview_window(label))
        .and_then(|w| w.scale_factor().ok())
        .or_else(|| {
            app.primary_monitor()
                .ok()
                .flatten()
                .map(|m| m.scale_factor())
        })
        .unwrap_or(1.0);
    decode(png_bytes(taskbar_is_light(), size_for_scale(scale)))
}

/// Re-reads the Windows theme and the display scale, then swaps the icon.
pub fn refresh_icon<R: Runtime>(app: &AppHandle<R>) {
    let (Some(tray), Some(icon)) = (app.tray_by_id(TRAY_ID), current_icon(app)) else {
        return;
    };
    if let Err(e) = tray.set_icon(Some(icon)) {
        tracing::warn!(error = %e, "could not update the tray icon");
    }
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let config = app.state::<ConfigState>();
    let current = config.settings().display_mode;

    let open = MenuItem::with_id(app, "open", OPEN, true, None::<&str>)?;
    let mode_items = MODES
        .iter()
        .map(|(mode, id, text)| {
            CheckMenuItem::with_id(app, *id, *text, true, *mode == current, None::<&str>)
        })
        .collect::<tauri::Result<Vec<_>>>()?;
    let mode_refs: Vec<&dyn IsMenuItem<R>> =
        mode_items.iter().map(|i| i as &dyn IsMenuItem<R>).collect();
    let mode = Submenu::with_items(app, MODE, true, &mode_refs)?;

    let scenes = config.scenes();
    let scene_items = scenes
        .iter()
        .map(|s| MenuItem::with_id(app, format!("scene:{}", s.id), &s.name, true, None::<&str>))
        .collect::<tauri::Result<Vec<_>>>()?;
    let scenes_menu = if scene_items.is_empty() {
        let none = MenuItem::with_id(app, "no-scene", NO_SCENES, false, None::<&str>)?;
        Submenu::with_items(app, SCENES, true, &[&none])?
    } else {
        let refs: Vec<&dyn IsMenuItem<R>> = scene_items
            .iter()
            .map(|i| i as &dyn IsMenuItem<R>)
            .collect();
        Submenu::with_items(app, SCENES, true, &refs)?
    };

    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", QUIT, true, None::<&str>)?;
    Menu::with_items(app, &[&open, &mode, &scenes_menu, &separator, &quit])
}

/// Rebuilds the menu from the current mode and scenes.
pub fn rebuild_menu<R: Runtime>(app: &AppHandle<R>) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    match build_menu(app) {
        Ok(menu) => {
            if let Err(e) = tray.set_menu(Some(menu)) {
                tracing::warn!(error = %e, "could not update the tray menu");
            }
        }
        Err(e) => tracing::warn!(error = %e, "could not build the tray menu"),
    }
}

fn on_menu<R: Runtime>(app: &AppHandle<R>, id: &str) {
    if let Some((mode, _, _)) = MODES.iter().find(|(_, mode_id, _)| *mode_id == id) {
        let patch = SettingsPatch {
            display_mode: Some(*mode),
            ..Default::default()
        };
        // Off the menu's own callback: a mode change builds a window.
        let app = app.clone();
        std::thread::spawn(move || {
            if let Err(e) = crate::ipc::update_settings(&app, patch) {
                tracing::warn!(error = %e, "could not change the display mode");
            }
            // A check box flips by itself: bring the menu back in line with the truth.
            rebuild_menu(&app);
        });
    } else if let Some(scene) = id.strip_prefix("scene:") {
        super::trigger_scene(app, scene);
    } else if id == "open" {
        super::show(app);
    } else if id == "quit" {
        super::quit(app);
    }
}

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(&app.package_info().name)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| on_menu(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                super::show(tray.app_handle());
            }
        });
    if let Some(icon) = current_icon(app) {
        builder = builder.icon(icon);
    }
    if let Ok(menu) = build_menu(app) {
        builder = builder.menu(&menu);
    }
    builder.build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_follows_display_scale() {
        let sizes: Vec<u32> = [1.0, 1.25, 1.5, 1.75, 2.0, 3.0]
            .iter()
            .map(|&s| size_for_scale(s))
            .collect();
        assert_eq!(sizes, [16, 20, 24, 24, 32, 32]);
    }

    #[test]
    fn every_embedded_icon_decodes_at_its_size() {
        for light in [false, true] {
            for size in [16, 20, 24, 32] {
                let icon = decode(png_bytes(light, size)).expect("decodes as RGBA8");
                assert_eq!((icon.width(), icon.height()), (size, size));
            }
        }
    }

    #[test]
    fn dark_taskbar_gets_the_white_glyph() {
        assert_ne!(png_bytes(true, 16), png_bytes(false, 16));
        let white = decode(png_bytes(false, 32)).unwrap();
        // The glyph pixels are opaque white, everything else transparent.
        assert!(white.rgba().chunks(4).any(|p| p == [255, 255, 255, 255]));
    }
}
