//! Building and configuring Kayro's two windows. `main` serves the immersive and the normal
//! modes (same window, reconfigured); `widget` is a transparent window of its own.

use tauri::window::Color;
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use super::geometry::{self, Screen};
use crate::config::schema::DisplayMode;
use crate::config::ui_state::{Placement, Rect};
use crate::platform::own_window;

pub const MAIN: &str = "main";
pub const WIDGET: &str = "widget";
/// Same as `--bg-deep`: what shows before the first paint (no white flash).
const BACKGROUND: Color = Color(23, 16, 33, 255);

pub fn label_for(mode: DisplayMode) -> &'static str {
    match mode {
        DisplayMode::Widget => WIDGET,
        DisplayMode::Immersive | DisplayMode::Window => MAIN,
    }
}

pub fn get<R: Runtime>(app: &AppHandle<R>, label: &str) -> Option<WebviewWindow<R>> {
    app.get_webview_window(label)
}

/// The window currently on screen, if any.
pub fn visible<R: Runtime>(app: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    [MAIN, WIDGET]
        .into_iter()
        .filter_map(|label| get(app, label))
        .find(|w| w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false))
}

pub fn screens<R: Runtime>(app: &AppHandle<R>) -> Vec<Screen> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let rect = |p: &PhysicalPosition<i32>, s: &PhysicalSize<u32>| Rect {
                x: p.x,
                y: p.y,
                width: s.width,
                height: s.height,
            };
            Screen {
                name: m.name().cloned(),
                rect: rect(m.position(), m.size()),
                work: rect(&m.work_area().position, &m.work_area().size),
                scale: m.scale_factor(),
            }
        })
        .collect()
}

/// Which of `screens` a mode should use: the remembered one, else the one under `window`, else
/// the one under the mouse pointer, else the main one.
pub fn choose_screen<R: Runtime>(
    app: &AppHandle<R>,
    screens: &[Screen],
    saved: &Placement,
    window: Option<&WebviewWindow<R>>,
) -> usize {
    if let Some(i) = geometry::find_screen(screens, saved.monitor.as_ref()) {
        return i;
    }
    let under_window = window.and_then(|w| {
        let (pos, size) = (w.outer_position().ok()?, w.outer_size().ok()?);
        let (cx, cy) = (
            pos.x + (size.width / 2) as i32,
            pos.y + (size.height / 2) as i32,
        );
        geometry::screen_at(screens, cx, cy)
    });
    let under_pointer = || {
        let p = app.cursor_position().ok()?;
        geometry::screen_at(screens, p.x as i32, p.y as i32)
    };
    let main = || {
        let primary = app.primary_monitor().ok().flatten()?;
        screens
            .iter()
            .position(|s| s.rect.x == primary.position().x && s.rect.y == primary.position().y)
    };
    under_window
        .or_else(under_pointer)
        .or_else(main)
        .unwrap_or(0)
}

/// Remembers where the window is, in the shape `geometry` reads back.
pub fn capture_placement<R: Runtime>(
    window: &WebviewWindow<R>,
    screens: &[Screen],
) -> Option<Placement> {
    let pos = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;
    let rect = Rect {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
    };
    let centre = (
        pos.x + (size.width / 2) as i32,
        pos.y + (size.height / 2) as i32,
    );
    let monitor = geometry::screen_at(screens, centre.0, centre.1).map(|i| screens[i].key());
    Some(Placement {
        monitor,
        rect: Some(rect),
    })
}

fn put<R: Runtime>(window: &WebviewWindow<R>, rect: Rect) {
    let _ = window.set_position(PhysicalPosition::new(rect.x, rect.y));
    let _ = window.set_size(PhysicalSize::new(rect.width, rect.height));
}

/// Sets the main window up for `mode` on `screen`. Works on a hidden window (before showing it)
/// and on a visible one (switching modes).
pub fn configure_main<R: Runtime>(
    window: &WebviewWindow<R>,
    mode: DisplayMode,
    screen: &Screen,
    saved: &Placement,
) {
    let immersive = mode == DisplayMode::Immersive;
    if immersive {
        // Taskbar cover is switched on with the focus (see `on_focus`), never while another
        // program is in front.
        let _ = window.set_resizable(false);
        let _ = window.set_decorations(false);
        let _ = window.set_shadow(false);
        let _ = window.set_zoom(geometry::immersive_zoom(screen));
        put(window, geometry::immersive_rect(screen));
    } else {
        let _ = window.set_always_on_top(false);
        let _ = window.set_zoom(1.0);
        let _ = window.set_decorations(true);
        let _ = window.set_shadow(true);
        let _ = window.set_resizable(true);
        put(window, geometry::window_rect(saved, screen));
    }
}

/// A hidden `main` window, ready for `mode`. The page asks to be revealed once painted.
pub fn create_main<R: Runtime>(
    app: &AppHandle<R>,
    mode: DisplayMode,
    screen: &Screen,
    saved: &Placement,
) -> tauri::Result<WebviewWindow<R>> {
    let window = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
        .title(&app.package_info().name)
        .visible(false)
        .decorations(mode == DisplayMode::Window)
        .resizable(mode == DisplayMode::Window)
        .shadow(mode == DisplayMode::Window)
        .background_color(BACKGROUND)
        .build()?;
    configure_main(&window, mode, screen, saved);
    Ok(window)
}

/// First size of the widget, replaced by the page's real size as soon as it has measured itself.
const WIDGET_START_LOGICAL: (f64, f64) = (760.0, 80.0);

/// A hidden transparent widget window at the top of `screen`.
pub fn create_widget<R: Runtime>(
    app: &AppHandle<R>,
    screen: &Screen,
    saved: &Placement,
) -> tauri::Result<WebviewWindow<R>> {
    let window =
        WebviewWindowBuilder::new(app, WIDGET, WebviewUrl::App("index.html?w=widget".into()))
            .title(&app.package_info().name)
            .visible(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .resizable(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .build()?;
    if let Ok(hwnd) = window.hwnd() {
        own_window::set_tool_window(hwnd.0 as isize);
    }
    let size = (
        (WIDGET_START_LOGICAL.0 * screen.scale).round() as u32,
        (WIDGET_START_LOGICAL.1 * screen.scale).round() as u32,
    );
    put(&window, geometry::widget_rect(saved, screen, size));
    Ok(window)
}
