//! Spike 01 — hidden window shown by a global shortcut: time from `Pressed` to first paint.
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const OUT_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/captures");

struct Spike {
    /// Set at `Pressed`, consumed by the first `mark_painted` of the cycle.
    pending: Mutex<Option<Instant>>,
    /// Last press time, kept for key timing.
    last_press: Mutex<Option<Instant>>,
    out: Mutex<File>,
}

impl Spike {
    fn line(&self, text: &str) {
        let _ = writeln!(self.out.lock().unwrap(), "{text}");
    }
}

#[tauri::command]
fn mark_painted(state: State<Spike>, source: String, focused: bool, visibility: String) {
    if let Some(t0) = state.pending.lock().unwrap().take() {
        let ms = t0.elapsed().as_secs_f64() * 1000.0;
        state.line(&format!(
            r#"{{"kind":"paint","ms":{ms:.2},"source":"{source}","focused":{focused},"visibility":"{visibility}"}}"#
        ));
    }
}

#[tauri::command]
fn mark_key(state: State<Spike>, key: String) {
    let ms = state.last_press.lock().unwrap().map(|t| t.elapsed().as_secs_f64() * 1000.0);
    state.line(&format!(r#"{{"kind":"key","key":"{key}","ms_since_press":{:.2}}}"#, ms.unwrap_or(-1.0)));
}

#[tauri::command]
fn js_log(state: State<Spike>, msg: String) {
    state.line(&format!(r#"{{"kind":"page","msg":{}}}"#, serde_json::json!(msg)));
}

fn on_press(app: &AppHandle) {
    let t0 = Instant::now();
    let state = app.state::<Spike>();
    *state.pending.lock().unwrap() = Some(t0);
    *state.last_press.lock().unwrap() = Some(t0);
    let Some(window) = app.get_webview_window("main") else { return };
    let _ = window.show();
    let _ = window.set_focus();
    let rust_ms = t0.elapsed().as_secs_f64() * 1000.0;
    state.line(&format!(r#"{{"kind":"rust_show","ms":{rust_ms:.2}}}"#));
    let _ = app.emit("shown", ());
    // Hide again after the harness had time to type a key and sample the pixels.
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(900));
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
            let _ = app.emit("hidden", ());
        }
    });
}

fn main() {
    fs::create_dir_all(OUT_DIR).unwrap();
    let out = OpenOptions::new().create(true).append(true).open(format!("{OUT_DIR}/results.jsonl")).unwrap();
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::F9);
    tauri::Builder::default()
        .manage(Spike { pending: Mutex::new(None), last_press: Mutex::new(None), out: Mutex::new(out) })
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        on_press(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            app.global_shortcut().register(shortcut)?;
            app.state::<Spike>().line(r#"{"kind":"ready"}"#);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![mark_painted, mark_key, js_log])
        .run(tauri::generate_context!())
        .expect("run");
}
