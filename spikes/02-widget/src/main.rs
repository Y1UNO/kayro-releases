//! Spike 02 — transparent borderless widget pill: CSS surface vs acrylic vs mica.
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::window::{Color, Effect, EffectsBuilder};
use tauri::{LogicalSize, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const OUT_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/captures");
const W: f64 = 560.0;

struct Spike {
    variant: String,
    out: Mutex<File>,
}

#[tauri::command]
fn get_variant(state: State<Spike>) -> String {
    state.variant.clone()
}

#[tauri::command]
fn report(state: State<Spike>, json: String) {
    let _ = writeln!(state.out.lock().unwrap(), "{json}");
}

/// Announces a test stage and writes the current window rectangle for the harness.
#[tauri::command]
fn stage(window: WebviewWindow, state: State<Spike>, name: String) {
    let pos = window.outer_position().unwrap_or_default();
    let size = window.outer_size().unwrap_or_default();
    let line = format!(
        r#"{{"stage":"{name}","x":{},"y":{},"w":{},"h":{}}}"#,
        pos.x, pos.y, size.width, size.height
    );
    let _ = fs::write(format!("{OUT_DIR}/stage_{}_{name}.txt", state.variant), &line);
    let _ = writeln!(state.out.lock().unwrap(), "{line}");
}

#[tauri::command]
fn set_height(window: WebviewWindow, h: f64) -> f64 {
    let t = Instant::now();
    let _ = window.set_size(LogicalSize::new(W, h));
    t.elapsed().as_secs_f64() * 1000.0
}

/// Moves the window 600 px right and back in 1.5 s, like a user drag would.
#[tauri::command]
async fn move_test(window: WebviewWindow) {
    let start = window.outer_position().unwrap_or_default();
    let t0 = Instant::now();
    let total = 1.5;
    loop {
        let t = t0.elapsed().as_secs_f64() / total;
        if t >= 1.0 {
            break;
        }
        let dx = (1.0 - (2.0 * t - 1.0).abs()) * 600.0;
        let _ = window.set_position(tauri::PhysicalPosition::new(start.x + dx as i32, start.y));
        std::thread::sleep(Duration::from_millis(2));
    }
    let _ = window.set_position(start);
}

fn main() {
    fs::create_dir_all(OUT_DIR).unwrap();
    let variant = std::env::args().skip_while(|a| a != "--variant").nth(1).unwrap_or_else(|| "css".into());
    let out = OpenOptions::new()
        .create(true)
        .append(true)
        .open(format!("{OUT_DIR}/results_{variant}.jsonl"))
        .unwrap();
    let v = variant.clone();
    tauri::Builder::default()
        .manage(Spike { variant, out: Mutex::new(out) })
        .setup(move |app| {
            let monitor = app.primary_monitor()?.expect("primary monitor");
            let mw = monitor.size().width as f64 / monitor.scale_factor();
            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Spike 02")
                .inner_size(W, 64.0)
                .position((mw - W) / 2.0, 12.0)
                .decorations(false)
                .transparent(true)
                .shadow(false)
                .skip_taskbar(true)
                .always_on_top(true)
                .resizable(false);
            match v.as_str() {
                "acrylic" => {
                    builder = builder.effects(
                        EffectsBuilder::new().effect(Effect::Acrylic).color(Color(30, 20, 38, 110)).build(),
                    )
                }
                "mica" => builder = builder.effects(EffectsBuilder::new().effect(Effect::Mica).build()),
                _ => {}
            }
            builder.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_variant, report, stage, set_height, move_test])
        .run(tauri::generate_context!())
        .expect("run");
}
