//! Kayro's own installer (« installeur maison »): a small window in Kayro's style which carries the
//! NSIS installer and runs it invisibly, so shortcuts, the « Désinstaller » entry, WebView2 and the
//! update over an older version stay NSIS's work. Without WebView2 (this window could not be
//! drawn) or after an error, the classic installer takes over.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod existing;
mod payload;

use std::cmp::Ordering;
use std::process::Command;

use serde::Serialize;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Info {
    version: String,
    /// The version already installed for this account, if any.
    installed: Option<String>,
    /// That one is newer: the installer would refuse to go back.
    newer_installed: bool,
    /// The installed Kayro is open (it must be closed first, softly).
    running: bool,
    /// This exe carries an installer (false only in a build made for tests).
    ready: bool,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum Outcome {
    Done,
    Failed { code: i32 },
}

fn version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn info(app: AppHandle) -> Info {
    let version = version(&app);
    let installed = existing::installed();
    Info {
        newer_installed: installed
            .as_ref()
            .is_some_and(|i| existing::compare_versions(&i.version, &version) == Ordering::Greater),
        running: installed
            .as_ref()
            .is_some_and(|i| existing::running(&i.exe())),
        installed: installed.map(|i| i.version),
        ready: payload::present(),
        version,
    }
}

#[tauri::command]
async fn close_kayro() -> bool {
    tauri::async_runtime::spawn_blocking(|| match existing::installed() {
        Some(i) => existing::close_softly(&i.exe()),
        None => true,
    })
    .await
    .unwrap_or(false)
}

#[tauri::command]
async fn install(app: AppHandle, desktop: bool, update_auto: bool) -> Outcome {
    let version = version(&app);
    tauri::async_runtime::spawn_blocking(move || {
        // Read by Kayro at its next start (src-tauri/src/update.rs), then removed.
        if let Err(e) = existing::write_install_choices(update_auto) {
            eprintln!("install choices not written: {e}");
        }
        let Ok(x) = payload::extract(&version) else {
            return Outcome::Failed { code: -1 };
        };
        let code = payload::install_silently(&x.exe, desktop, existing::desktop_dir().as_deref())
            .unwrap_or(-1);
        // Success is the exit code and the version now recorded by the installer.
        let landed = existing::installed()
            .is_some_and(|i| existing::compare_versions(&i.version, &version) == Ordering::Equal);
        if code == 0 && landed {
            Outcome::Done
        } else {
            Outcome::Failed { code }
        }
    })
    .await
    .unwrap_or(Outcome::Failed { code: -1 })
}

#[tauri::command]
fn launch(app: AppHandle) -> bool {
    let started = existing::installed().is_some_and(|i| Command::new(i.exe()).spawn().is_ok());
    if started {
        app.exit(0);
    }
    started
}

#[tauri::command]
fn classic(app: AppHandle) -> bool {
    let started = payload::run_classic(&version(&app));
    if started {
        app.exit(0);
    }
    started
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

fn main() {
    let context = tauri::generate_context!();
    // No WebView2: this window cannot be drawn; the classic installer fetches it and does the rest.
    if tauri::webview_version().is_err() {
        payload::run_classic(&context.package_info().version.to_string());
        return;
    }
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            info,
            close_kayro,
            install,
            launch,
            classic,
            quit
        ])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Installer Kayro")
                .inner_size(760.0, 480.0)
                .resizable(false)
                .maximizable(false)
                .decorations(false)
                .shadow(true)
                .center()
                .background_color(tauri::window::Color(6, 5, 13, 255))
                // Its WebView data goes to the temporary folder, not next to the user's data.
                .data_directory(std::env::temp_dir().join("kayro-setup-webview"))
                .build()?;
            Ok(())
        })
        .run(context)
        .expect("l'installeur n'a pas pu démarrer");
}
