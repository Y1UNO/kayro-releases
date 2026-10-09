pub mod config;
pub mod detect;
pub mod error;
pub mod icons;
pub mod intake;
pub mod ipc;
pub mod launcher;
mod logging;
pub mod paths;
pub mod platform;
pub mod procwatch;

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
            app.manage(detect::scan::DetectState::default());
            let for_apps = app.handle().clone();
            let for_events = app.handle().clone();
            app.manage(procwatch::ProcWatch::start_system(
                move || for_apps.state::<ConfigState>().apps().apps,
                move |state| {
                    use tauri_specta::Event;
                    ipc::notify(ipc::AppStateChanged(state).emit(&for_events));
                },
            ));
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
