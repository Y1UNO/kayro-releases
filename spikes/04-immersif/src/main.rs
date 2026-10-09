//! Spike 04 — borderless "immersive" window sized exactly to a monitor (no exclusive fullscreen),
//! moved between monitors, compared with `set_fullscreen`.
use std::fs::{self, File};
use std::io::Write;
use std::sync::Mutex;
use std::time::Instant;

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const OUT_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/captures");

struct Spike {
    started: Instant,
    out: Mutex<File>,
}

#[tauri::command]
fn report(state: State<Spike>, json: String) {
    let _ = writeln!(state.out.lock().unwrap(), "{json}");
}

#[tauri::command]
fn since_start_ms(state: State<Spike>) -> f64 {
    state.started.elapsed().as_secs_f64() * 1000.0
}

#[tauri::command]
fn monitors(window: WebviewWindow) -> Vec<String> {
    window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            format!(
                "{} pos=({},{}) size={}x{} scale={}",
                m.name().cloned().unwrap_or_default(),
                m.position().x,
                m.position().y,
                m.size().width,
                m.size().height,
                m.scale_factor()
            )
        })
        .collect()
}

/// Resizes/moves the borderless window to monitor `idx`; returns the call duration in ms.
#[tauri::command]
fn move_to(window: WebviewWindow, idx: usize) -> f64 {
    let t = Instant::now();
    if let Some(m) = window.available_monitors().unwrap_or_default().get(idx) {
        let _ = window.set_position(PhysicalPosition::new(m.position().x, m.position().y));
        let _ = window.set_size(PhysicalSize::new(m.size().width, m.size().height));
    }
    t.elapsed().as_secs_f64() * 1000.0
}

#[tauri::command]
fn set_fs(window: WebviewWindow, on: bool) -> f64 {
    let t = Instant::now();
    let _ = window.set_fullscreen(on);
    t.elapsed().as_secs_f64() * 1000.0
}

/// Writes the window rectangle so the harness can sample pixels / read window styles.
#[tauri::command]
fn stage(window: WebviewWindow, state: State<Spike>, name: String) {
    let pos = window.outer_position().unwrap_or_default();
    let size = window.outer_size().unwrap_or_default();
    let line = format!(r#"{{"stage":"{name}","x":{},"y":{},"w":{},"h":{}}}"#, pos.x, pos.y, size.width, size.height);
    let _ = fs::write(format!("{OUT_DIR}/stage_{name}.txt"), &line);
    let _ = writeln!(state.out.lock().unwrap(), "{line}");
}

#[tauri::command]
fn finish(app: AppHandle) {
    app.exit(0);
}

fn main() {
    let started = Instant::now();
    fs::create_dir_all(OUT_DIR).unwrap();
    for entry in fs::read_dir(OUT_DIR).unwrap().flatten() {
        if entry.file_name().to_string_lossy().starts_with("stage_") {
            let _ = fs::remove_file(entry.path());
        }
    }
    let file = File::create(format!("{OUT_DIR}/results.jsonl")).unwrap();
    // `--monitor N`: monitor index to start on (0 = first returned by Windows).
    let shadow = std::env::args().any(|a| a == "--shadow");
    let topmost = std::env::args().any(|a| a == "--topmost");
    let start_idx: usize = std::env::args().skip_while(|a| a != "--monitor").nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    tauri::Builder::default()
        .manage(Spike { started, out: Mutex::new(file) })
        .setup(move |app| {
            let (shadow, topmost) = (shadow, topmost);
            let monitors = app.available_monitors()?;
            let m = monitors.get(start_idx).or(monitors.first()).expect("a monitor");
            let s = m.scale_factor();
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Spike 04")
                .decorations(false)
                .shadow(shadow)
                .resizable(false)
                .skip_taskbar(false)
                .always_on_top(topmost)
                .position(m.position().x as f64 / s, m.position().y as f64 / s)
                .inner_size(m.size().width as f64 / s, m.size().height as f64 / s)
                .background_color(tauri::window::Color(23, 16, 33, 255))
                .build()?;
            let _ = win.set_focus();
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![report, since_start_ms, monitors, move_to, set_fs, stage, finish])
        .run(tauri::generate_context!())
        .expect("run");
}
