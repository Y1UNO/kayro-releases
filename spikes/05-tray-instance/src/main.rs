//! Spike 05 — tray icon + single instance + silent start (`--silent`) + autostart mechanism.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::OnceLock;
use std::time::Instant;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

const OUT_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/captures");
static T0: OnceLock<Instant> = OnceLock::new();

fn log(kind: &str, extra: &str) {
    let ms = T0.get().map(|t| t.elapsed().as_secs_f64() * 1000.0).unwrap_or(-1.0);
    let epoch = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let line = format!(r#"{{"kind":"{kind}","pid":{},"t":{epoch},"ms_since_main":{ms:.1}{extra}}}"#, std::process::id());
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(format!("{OUT_DIR}/results.jsonl")) {
        let _ = writeln!(f, "{line}");
    }
}

fn show(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        log("shown", &format!(r#","visible":{},"focused":{}"#, w.is_visible().unwrap_or(false), w.is_focused().unwrap_or(false)));
    }
}

fn args_has(flag: &str) -> bool {
    std::env::args().any(|a| a == flag)
}

fn painted() {
    log("painted", "");
}

fn main() {
    T0.set(Instant::now()).ok();
    fs::create_dir_all(OUT_DIR).unwrap();
    let args: Vec<String> = std::env::args().collect();
    let silent = args.iter().any(|a| a == "--silent");
    let autostart_cmd = args.iter().position(|a| a == "--autostart").and_then(|i| args.get(i + 1)).cloned();
    let exit_after = args.iter().any(|a| a == "--exit");
    log("main", &format!(r#","silent":{silent}"#));

    tauri::Builder::default()
        // Must be the first plugin registered.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            log("second_instance_callback", &format!(r#","args":{}"#, args.len()));
            show(app);
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--silent"])))
        .setup(move |app| {
            log("setup_start", "");
            if let Some(cmd) = &autostart_cmd {
                let al = app.autolaunch();
                let r = if cmd == "enable" { al.enable() } else { al.disable() };
                log("autostart", &format!(r#","cmd":"{cmd}","ok":{},"is_enabled":{}"#, r.is_ok(), al.is_enabled().unwrap_or(false)));
            }
            if exit_after {
                std::process::exit(0);
            }
            let show_i = MenuItem::with_id(app, "show", "Afficher", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("window icon").clone())
                .tooltip("Spike 05")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show(tray.app_handle());
                    }
                })
                .build(app)?;
            log("tray_ready", "");
            // Window created AFTER the tray (hidden): the tray no longer waits for WebView2.
            {
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("Spike 05")
                    .inner_size(640.0, 400.0)
                    .center()
                    .visible(false)
                    .background_color(tauri::window::Color(23, 16, 33, 255))
                    .build()?;
                log("window_built", "");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![painted_wrapper])
        .run(tauri::generate_context!())
        .expect("run");
}

#[tauri::command]
fn painted_wrapper(window: tauri::WebviewWindow) {
    painted();
    // Silent start: the window must stay hidden; otherwise show it once painted.
    if !std::env::args().any(|a| a == "--silent") {
        let _ = window.show();
    }
}
