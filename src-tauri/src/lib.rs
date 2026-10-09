pub mod config;
pub mod error;
pub mod ipc;
mod logging;
pub mod paths;

use config::ConfigState;
use error::AppError;
use tauri::{AppHandle, Manager, WebviewWindow};

const MAIN_WINDOW: &str = "main";
pub(crate) const SILENT_FLAG: &str = "--silent";

fn main_window(app: &AppHandle) -> Result<WebviewWindow, AppError> {
    app.get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| AppError::not_found(format!("window «{MAIN_WINDOW}»")))
}

pub(crate) fn show_and_focus(app: &AppHandle) -> Result<(), AppError> {
    let window = main_window(app)?;
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;
    Ok(())
}

pub fn run() {
    let _log_guard = logging::init();
    tracing::info!(version = env!("CARGO_PKG_VERSION"), "starting");

    let ipc = ipc::builder();
    // Keeps the committed TypeScript bindings in step while developing.
    #[cfg(debug_assertions)]
    if let Err(e) = ipc.export(
        specta_typescript::Typescript::default(),
        concat!(env!("CARGO_MANIFEST_DIR"), "/../src/ipc/bindings.ts"),
    ) {
        tracing::warn!(error = %e, "could not export the TypeScript bindings");
    }

    tauri::Builder::default()
        // Must be the first plugin registered.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            tracing::info!(?args, "second instance: showing the window");
            if let Err(e) = show_and_focus(app) {
                tracing::warn!(error = %e, "could not show the window");
            }
        }))
        .invoke_handler(ipc.invoke_handler())
        .setup(move |app| {
            tracing::info!(app_name = %app.package_info().name, "setup done");
            ipc.mount_events(app);
            app.manage(ConfigState::load(paths::DataPaths::default_location()));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn ping_answers_pong() {
        assert_eq!(super::ipc::ping(), "pong");
    }
}
