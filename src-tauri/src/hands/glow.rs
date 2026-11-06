//! The glow under the cursor while a hand leads it (step 22): a soft round light on Kysland's
//! native layer (platform/overlay.rs: click-through, never activated, out of Alt+Tab), above
//! every window. White and wide while the hand is free, small and blue while the left pinch
//! holds, amber for the right one. It also says the camera sees the hand.

use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Runtime};

use super::pointer::Grip;
use crate::platform::overlay;

/// The image's side (physical pixels).
const SIDE: u32 = 44;

static LAYER: Mutex<Option<isize>> = Mutex::new(None);

fn layer<R: Runtime>(app: &AppHandle<R>) -> Option<isize> {
    let mut guard = LAYER.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        let (tx, rx) = std::sync::mpsc::channel();
        let made = app.run_on_main_thread(move || {
            let _ = tx.send(overlay::create());
        });
        if made.is_ok() {
            *guard = rx.recv_timeout(Duration::from_millis(500)).ok().flatten();
        }
    }
    *guard
}

/// The glow for `grip`, premultiplied BGRA.
pub fn image(grip: Grip) -> Vec<u32> {
    let (rgb, radius, strength) = match grip {
        Grip::Free => ([255.0, 255.0, 255.0], 15.0, 0.42),
        Grip::Left => ([122.0, 178.0, 255.0], 9.0, 0.75),
        Grip::Right => ([255.0, 190.0, 120.0], 9.0, 0.75),
    };
    let c = (SIDE as f32 - 1.0) / 2.0;
    let mut px = Vec::with_capacity((SIDE * SIDE) as usize);
    for y in 0..SIDE {
        for x in 0..SIDE {
            let r = ((x as f32 - c).powi(2) + (y as f32 - c).powi(2)).sqrt();
            // A soft disc, and a thin ring at its edge.
            let disc = (-(r / radius).powi(2)).exp() * strength;
            let ring = (-((r - radius) / 1.6).powi(2)).exp() * strength * 0.8;
            let a = (disc + ring).min(1.0) * ((c - r) / 4.0).clamp(0.0, 1.0);
            let p = |v: f32| (v * a).round() as u32;
            px.push(
                ((a * 255.0).round() as u32) << 24 | p(rgb[0]) << 16 | p(rgb[1]) << 8 | p(rgb[2]),
            );
        }
    }
    px
}

/// Shows the glow centred on `x`, `y` (physical pixels of the desktop).
pub fn show<R: Runtime>(app: &AppHandle<R>, x: i32, y: i32, pixels: &[u32]) {
    if let Some(raw) = layer(app) {
        let half = (SIDE / 2) as i32;
        overlay::paint_top(raw, x - half, y - half, SIDE, SIDE, pixels);
    }
}

/// Moves the glow already shown (no new image).
pub fn place(x: i32, y: i32) {
    if let Some(raw) = *LAYER.lock().unwrap_or_else(|e| e.into_inner()) {
        let half = (SIDE / 2) as i32;
        overlay::place(raw, x - half, y - half);
    }
}

pub fn hide() {
    if let Some(raw) = *LAYER.lock().unwrap_or_else(|e| e.into_inner()) {
        overlay::hide(raw);
    }
}
