//! Notification-area icon: white or black glyph following the Windows theme, sized for the
//! display scale. Left click brings the window back.

use tauri::image::Image;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};

use crate::platform::theme::taskbar_is_light;

const TRAY_ID: &str = "main";
const MAIN_WINDOW: &str = "main";

/// Light taskbar → black glyph; dark taskbar → white glyph.
fn png_bytes(light_taskbar: bool, size: u32) -> &'static [u8] {
    macro_rules! pick {
        ($colour:literal) => {
            match size {
                16 => &include_bytes!(concat!("../icons/tray-", $colour, "-16.png"))[..],
                20 => &include_bytes!(concat!("../icons/tray-", $colour, "-20.png"))[..],
                24 => &include_bytes!(concat!("../icons/tray-", $colour, "-24.png"))[..],
                _ => &include_bytes!(concat!("../icons/tray-", $colour, "-32.png"))[..],
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

fn current_icon(app: &AppHandle) -> Option<Image<'static>> {
    let scale = app
        .get_webview_window(MAIN_WINDOW)
        .and_then(|w| w.scale_factor().ok())
        .unwrap_or(1.0);
    decode(png_bytes(taskbar_is_light(), size_for_scale(scale)))
}

/// Re-reads the Windows theme and the display scale, then swaps the icon.
fn refresh(app: &AppHandle) {
    let (Some(tray), Some(icon)) = (app.tray_by_id(TRAY_ID), current_icon(app)) else {
        return;
    };
    if let Err(e) = tray.set_icon(Some(icon)) {
        tracing::warn!(error = %e, "could not update the tray icon");
    }
}

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(&app.package_info().name)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Err(e) = crate::show_and_focus(tray.app_handle()) {
                    tracing::warn!(error = %e, "could not show the window");
                }
            }
        });
    if let Some(icon) = current_icon(app) {
        builder = builder.icon(icon);
    }
    builder.build(app)?;

    // Windows tells every window when the theme or the display scale changes.
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let handle = app.clone();
        window.on_window_event(move |event| {
            if matches!(
                event,
                WindowEvent::ThemeChanged(_) | WindowEvent::ScaleFactorChanged { .. }
            ) {
                refresh(&handle);
            }
        });
    }
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
