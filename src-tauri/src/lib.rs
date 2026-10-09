mod error;
mod logging;
mod paths;

use error::AppError;
use tauri::{AppHandle, Manager, WebviewWindow};

const MAIN_WINDOW: &str = "main";
const SILENT_FLAG: &str = "--silent";

fn main_window(app: &AppHandle) -> Result<WebviewWindow, AppError> {
    app.get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| AppError::WindowNotFound(MAIN_WINDOW.into()))
}

fn show_and_focus(app: &AppHandle) -> Result<(), AppError> {
    let window = main_window(app)?;
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
    Ok(())
}

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

/// Called by the UI after its first paint: the window stays hidden until then (no white
/// flash), and stays hidden for good when started with `--silent`.
#[tauri::command]
fn app_ready(app: AppHandle) -> Result<(), AppError> {
    if std::env::args().any(|a| a == SILENT_FLAG) {
        tracing::info!("silent start: window stays hidden");
        return Ok(());
    }
    show_and_focus(&app)
}

pub fn run() {
    let _log_guard = logging::init();
    tracing::info!(version = env!("CARGO_PKG_VERSION"), "starting");

    tauri::Builder::default()
        // Must be the first plugin registered.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            tracing::info!(?args, "second instance: showing the window");
            if let Err(e) = show_and_focus(app) {
                tracing::warn!(error = %e, "could not show the window");
            }
        }))
        .setup(|app| {
            tracing::info!(app_name = %app.package_info().name, "setup done");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ping, app_ready])
        .run(tauri::generate_context!())
        .expect("error while running the application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn ping_answers_pong() {
        assert_eq!(super::ping(), "pong");
    }
}
