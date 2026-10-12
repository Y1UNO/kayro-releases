pub mod config;
pub mod desktop;
pub mod detect;
pub mod error;
pub mod icons;
pub mod intake;
pub mod ipc;
pub mod ipc_desktop;
pub mod ipc_scenes;
pub mod launcher;
mod legacy;
mod logging;
pub mod paths;
pub mod platform;
pub mod procwatch;
pub mod scenes;

use config::ConfigState;
use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;

pub(crate) const SILENT_FLAG: &str = "--silent";
/// `Kayro.exe --quit`: the running Kayro quits as with « Quitter » (the update script, which must
/// replace the exe, never kills it); with no Kayro running, this one ends at once.
pub(crate) const QUIT_FLAG: &str = "--quit";

fn asks_to_quit<S: AsRef<str>>(args: &[S]) -> bool {
    args.iter().any(|a| a.as_ref() == QUIT_FLAG)
}

pub fn run() {
    // Before the logger: it creates the new data folder, which would hide the old one.
    let migration = legacy::migrate_legacy_data(&paths::appdata_base());
    let _log_guard = logging::init();
    legacy::log_outcome(&migration);
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
            if asks_to_quit(&args) {
                tracing::info!("second instance: asked to quit");
                return desktop::quit(app);
            }
            tracing::info!(?args, "second instance: showing the window");
            desktop::show(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![SILENT_FLAG]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        desktop::on_hotkey(app, shortcut.id());
                    }
                })
                .build(),
        )
        .invoke_handler(ipc.invoke_handler())
        .setup(move |app| {
            if asks_to_quit(&std::env::args().collect::<Vec<_>>()) {
                tracing::info!("asked to quit, no Kayro was running");
                app.handle().exit(0);
                return Ok(());
            }
            tracing::info!(app_name = %app.package_info().name, "setup done");
            ipc.mount_events(app);
            app.manage(ConfigState::load(paths::DataPaths::default_location()));
            app.manage(detect::scan::DetectState::default());
            app.manage(scenes::SceneRunner::default());
            app.manage(desktop::DesktopState::default());
            app.manage(desktop::hotkeys::HotkeyState::default());
            // The icon first, then the window: the icon is there ~0.5 s sooner (spike 05).
            desktop::tray::setup(app.handle())?;
            let for_apps = app.handle().clone();
            let for_events = app.handle().clone();
            app.manage(procwatch::ProcWatch::start_system(
                move || for_apps.state::<ConfigState>().apps().apps,
                move |state| {
                    use tauri_specta::Event;
                    ipc::notify(ipc::AppStateChanged(state).emit(&for_events));
                },
            ));
            let silent = std::env::args().any(|a| a == SILENT_FLAG);
            desktop::startup(app.handle(), silent);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the application")
        .run(|_app, event| {
            // The hub lives in the notification area: destroying the last window (economy mode)
            // must not end it. Only the menu's « Quitter » (`app.exit`) does.
            if let tauri::RunEvent::ExitRequested {
                api, code: None, ..
            } = event
            {
                api.prevent_exit();
            }
        });
}

#[cfg(test)]
mod tests {
    #[test]
    fn ping_answers_pong() {
        assert_eq!(super::ipc::ping(), "pong");
    }

    #[test]
    fn only_the_quit_flag_asks_to_quit() {
        assert!(super::asks_to_quit(&["Kayro.exe", "--quit"]));
        assert!(!super::asks_to_quit(&["Kayro.exe", "--silent"]));
        assert!(!super::asks_to_quit::<&str>(&[]));
    }
}
