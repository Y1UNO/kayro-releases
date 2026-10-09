//! Spike 03 — cost of N `backdrop-filter` surfaces over animated mist + a particle canvas.
//! The window covers the primary monitor; a sampler thread logs the CPU of the whole process
//! tree (this exe + its msedgewebview2.exe children) every 500 ms.
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Write;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use sysinfo::{Pid, ProcessesToUpdate, System};
use tauri::{AppHandle, State, WebviewUrl, WebviewWindowBuilder};

const OUT_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/captures");

struct Out(Mutex<File>);

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
}

#[tauri::command]
fn report(state: State<Out>, json: String) {
    let _ = writeln!(state.0.lock().unwrap(), "{json}");
}

#[tauri::command]
fn finish(app: AppHandle) {
    app.exit(0);
}

fn tree_pids(sys: &System, root: Pid) -> HashSet<Pid> {
    let mut set = HashSet::from([root]);
    loop {
        let before = set.len();
        for (pid, p) in sys.processes() {
            if p.parent().is_some_and(|pp| set.contains(&pp)) {
                set.insert(*pid);
            }
        }
        if set.len() == before {
            return set;
        }
    }
}

fn spawn_sampler(app: AppHandle) {
    std::thread::spawn(move || {
        let root = Pid::from_u32(std::process::id());
        let mut sys = System::new();
        let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1) as f32;
        loop {
            sys.refresh_processes(ProcessesToUpdate::All, true);
            let tree = tree_pids(&sys, root);
            let cpu: f32 = tree.iter().filter_map(|p| sys.process(*p)).map(|p| p.cpu_usage()).sum();
            let mem: u64 = tree.iter().filter_map(|p| sys.process(*p)).map(|p| p.memory()).sum();
            let line = format!(
                r#"{{"kind":"cpu","t":{},"machine_pct":{:.2},"procs":{},"rss_mb":{}}}"#,
                now_ms(),
                cpu / cores,
                tree.len(),
                mem / 1_048_576
            );
            if let Some(out) = tauri::Manager::try_state::<Out>(&app) {
                let _ = writeln!(out.0.lock().unwrap(), "{line}");
            }
            std::thread::sleep(Duration::from_millis(500));
        }
    });
}

fn main() {
    fs::create_dir_all(OUT_DIR).unwrap();
    let file = File::create(format!("{OUT_DIR}/results.jsonl")).unwrap();
    tauri::Builder::default()
        .manage(Out(Mutex::new(file)))
        .setup(|app| {
            let m = app.primary_monitor()?.expect("primary monitor");
            let s = m.scale_factor();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Spike 03")
                .decorations(false)
                .always_on_top(true)
                .resizable(false)
                .position(m.position().x as f64 / s, m.position().y as f64 / s)
                .inner_size(m.size().width as f64 / s, m.size().height as f64 / s)
                .background_color(tauri::window::Color(23, 16, 33, 255))
                .build()?;
            spawn_sampler(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![report, finish])
        .run(tauri::generate_context!())
        .expect("run");
}
