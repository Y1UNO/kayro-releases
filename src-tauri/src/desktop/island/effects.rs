//! Step 20 (Kysland): the island's effects that its window must not cut (the glitch's spikes on
//! the edge between two screens, or along the top edge). The page draws them as shapes on the
//! desktop; they are rasterised here and shown by the effects layer (platform/overlay.rs): a
//! click-through window that stays where the effect is while the island moves on. Nothing is
//! kept once the effect has faded.

use std::sync::Mutex;
use std::time::Duration;

use serde::Deserialize;
use specta::Type;
use tauri::{AppHandle, Runtime};

use super::raster::{Image, Pt};
use crate::desktop::windows::{self, WIDGET};
use crate::platform::overlay;

/// One shape of an effect: a polygon, desktop logical pixels (x, y pairs), its colours
/// (0xRRGGBB) and white specks (x, y pairs).
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FxShape {
    pub pts: Vec<f64>,
    pub fill: u32,
    pub stroke: Option<u32>,
    pub dots: Vec<f64>,
}

/// A held frame of the effects: its shapes, their opacity, the island window's scale.
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FxFrame {
    pub shapes: Vec<FxShape>,
    pub alpha: f64,
    pub scale: f64,
}

const MAX_SHAPES: usize = 64;
const MAX_POINTS: usize = 64;
const MAX_DOTS: usize = 64;
/// Room around the shapes for their outlines (physical pixels).
const MARGIN: f64 = 3.0;

/// The effects window, made once on the window thread.
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

/// Hides the effects (the island hid, docked, or a program in full screen came in front).
pub fn hide() {
    if let Some(raw) = *LAYER.lock().unwrap_or_else(|e| e.into_inner()) {
        overlay::hide(raw);
    }
}

fn pairs(v: &[f64], scale: f64, at: Pt) -> Vec<Pt> {
    v.as_chunks::<2>()
        .0
        .iter()
        .filter(|[x, y]| x.is_finite() && y.is_finite())
        .map(|[x, y]| (x * scale - at.0, y * scale - at.1))
        .collect()
}

/// The frame as an image: its top-left corner on the desktop (physical) and its pixels. None
/// when there is nothing to show.
pub fn rasterise(frame: &FxFrame) -> Option<(i32, i32, Image)> {
    let scale = if frame.scale.is_finite() && frame.scale > 0.0 {
        frame.scale
    } else {
        1.0
    };
    let alpha = frame.alpha.clamp(0.0, 1.0) as f32;
    let shapes: Vec<&FxShape> = frame.shapes.iter().take(MAX_SHAPES).collect();
    if alpha <= 0.01 || shapes.is_empty() {
        return None;
    }
    let all: Vec<Pt> = shapes
        .iter()
        .flat_map(|s| pairs(&s.pts[..s.pts.len().min(MAX_POINTS * 2)], scale, (0.0, 0.0)))
        .collect();
    let (x0, y0, x1, y1) = all
        .iter()
        .fold((f64::MAX, f64::MAX, f64::MIN, f64::MIN), |b, p| {
            (b.0.min(p.0), b.1.min(p.1), b.2.max(p.0), b.3.max(p.1))
        });
    if all.is_empty() {
        return None;
    }
    let side = f64::from(overlay::MAX_SIDE);
    let (left, top) = ((x0 - MARGIN).floor(), (y0 - MARGIN).floor());
    let width = ((x1 + MARGIN).ceil() - left).clamp(1.0, side) as usize;
    let height = ((y1 + MARGIN).ceil() - top).clamp(1.0, side) as usize;
    let mut img = Image::new(width, height);
    for s in shapes {
        let pts = pairs(
            &s.pts[..s.pts.len().min(MAX_POINTS * 2)],
            scale,
            (left, top),
        );
        img.fill(&pts, s.fill & 0xff_ffff, alpha);
        if let Some(line) = s.stroke {
            img.stroke(&pts, line & 0xff_ffff, alpha, 1.2 * scale);
        }
        let speck = 1.2 * scale;
        for d in pairs(
            &s.dots[..s.dots.len().min(MAX_DOTS * 2)],
            scale,
            (left, top),
        ) {
            let sq = [
                (d.0, d.1),
                (d.0 + speck, d.1),
                (d.0 + speck, d.1 + speck),
                (d.0, d.1 + speck),
            ];
            img.fill(&sq, 0xff_ffff, alpha);
        }
    }
    Some((left as i32, top as i32, img))
}

/// Shows a held frame of the effects (hides them when it is empty, or when the island is not on
/// screen).
pub fn show<R: Runtime>(app: &AppHandle<R>, frame: &FxFrame) {
    let island = windows::get(app, WIDGET)
        .filter(|w| w.is_visible().unwrap_or(false))
        .and_then(|w| w.hwnd().ok());
    let (Some(island), Some((x, y, img))) = (island, rasterise(frame)) else {
        hide();
        return;
    };
    if let Some(raw) = layer(app) {
        overlay::paint(
            raw,
            island.0 as isize,
            x,
            y,
            img.width as u32,
            img.height as u32,
            &img.px,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spike(fill: u32) -> FxShape {
        FxShape {
            pts: vec![100.0, 50.0, 140.0, 60.0, 100.0, 70.0],
            fill,
            stroke: Some(0x8b3dff),
            dots: vec![110.0, 60.0],
        }
    }

    #[test]
    fn a_frame_becomes_an_image_where_its_shapes_are_scaled_for_the_screen() {
        let frame = FxFrame {
            shapes: vec![spike(0xff1f4d)],
            alpha: 1.0,
            scale: 1.5,
        };
        let (x, y, img) = rasterise(&frame).expect("an image");
        assert_eq!((x, y), (147, 72), "150 × 1.5 less the margin");
        assert!(img.width > 60 && img.height > 30);
        assert!(img.px.iter().any(|p| p >> 24 > 200));
    }

    #[test]
    fn an_empty_or_faded_frame_shows_nothing_and_bad_numbers_are_dropped() {
        let none = FxFrame {
            shapes: vec![],
            alpha: 1.0,
            scale: 1.0,
        };
        assert!(rasterise(&none).is_none());
        let faded = FxFrame {
            shapes: vec![spike(0xffffff)],
            alpha: 0.0,
            scale: 1.0,
        };
        assert!(rasterise(&faded).is_none());
        let mut odd = spike(0xffffff);
        odd.pts.extend([f64::NAN, 3.0]);
        let frame = FxFrame {
            shapes: vec![odd],
            alpha: 1.0,
            scale: f64::NAN,
        };
        assert!(rasterise(&frame).is_some());
    }
}
