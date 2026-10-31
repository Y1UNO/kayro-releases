//! Step 20 (Kysland): the lightness of the screen around the island (its colours follow it:
//! snow blue on a dark screen, ink blue on a light one). One small read of the screen, averaged
//! at once; nothing is kept.

use tauri::{AppHandle, Runtime};

use super::regions::physical;
use super::{locate, V2};
use crate::desktop::geometry::Screen;
use crate::desktop::windows::{self, WIDGET};
use crate::platform::island as win;

/// The lightness of the screen around the island anchored at `a` (its own pixels left out).
pub fn backdrop_at(a: V2, scale: f64, screen: &Screen) -> Option<f64> {
    let p = |v: f64| physical(v, scale);
    let r = &screen.rect;
    let x0 = (a.x as i32 - p(170.0)).max(r.x);
    let y0 = (a.y as i32 - p(30.0)).max(r.y);
    let x1 = (a.x as i32 + p(170.0)).min(r.x + r.width as i32);
    let y1 = (a.y as i32 + p(130.0)).min(r.y + r.height as i32);
    let hole = (
        a.x as i32 - p(110.0),
        a.y as i32 - p(10.0),
        p(220.0),
        p(70.0),
    );
    win::lightness((x0, y0, x1 - x0, y1 - y0), hole).map(f64::from)
}

/// The lightness behind the island now (hovered or shown: its colours follow the screen).
pub fn backdrop_now<R: Runtime>(app: &AppHandle<R>) -> Option<f64> {
    let window = windows::get(app, WIDGET)?;
    let screens = windows::screens(app);
    let (a, scale, i) = locate(&window, &screens)?;
    backdrop_at(a, scale, screens.get(i)?)
}
