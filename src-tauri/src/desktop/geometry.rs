//! Where each display mode puts its window. Pure functions on physical pixels, so the awkward
//! cases (unplugged screen, odd scale, tiny work area) are covered by tests and not by hand.

use crate::config::ui_state::{MonitorKey, Placement, Rect};

/// Default size of the normal window, in logical pixels (the mock-ups' composition).
pub const WINDOW_LOGICAL: (f64, f64) = (1280.0, 760.0);
/// Height of the composition the immersive mode scales up from (PLAN.md §6.3).
const COMPOSITION_HEIGHT: f64 = 760.0;
const MAX_ZOOM: f64 = 1.5;

/// One screen as Windows reports it.
#[derive(Debug, Clone, PartialEq)]
pub struct Screen {
    pub name: Option<String>,
    /// Whole screen.
    pub rect: Rect,
    /// Without the taskbar.
    pub work: Rect,
    pub scale: f64,
}

impl Screen {
    pub fn key(&self) -> MonitorKey {
        MonitorKey {
            name: self.name.clone(),
            rect: self.rect,
        }
    }
}

fn right(r: &Rect) -> i64 {
    i64::from(r.x) + i64::from(r.width)
}

fn bottom(r: &Rect) -> i64 {
    i64::from(r.y) + i64::from(r.height)
}

fn contains(r: &Rect, x: i32, y: i32) -> bool {
    i64::from(x) >= i64::from(r.x)
        && i64::from(x) < right(r)
        && i64::from(y) >= i64::from(r.y)
        && i64::from(y) < bottom(r)
}

/// The screen a remembered placement belongs to: same name, else same rectangle.
pub fn find_screen(screens: &[Screen], saved: Option<&MonitorKey>) -> Option<usize> {
    let key = saved?;
    screens
        .iter()
        .position(|s| key.name.is_some() && s.name == key.name)
        .or_else(|| screens.iter().position(|s| s.rect == key.rect))
}

/// [`find_screen`], else `fallback` (clamped to the list). `screens` must not be empty.
pub fn pick_screen(screens: &[Screen], saved: Option<&MonitorKey>, fallback: usize) -> usize {
    find_screen(screens, saved).unwrap_or_else(|| fallback.min(screens.len().saturating_sub(1)))
}

/// Index of the screen holding the point, if any.
pub fn screen_at(screens: &[Screen], x: i32, y: i32) -> Option<usize> {
    screens.iter().position(|s| contains(&s.rect, x, y))
}

/// Moves and shrinks `rect` so it lies inside `area`.
pub fn clamp_into(rect: Rect, area: Rect) -> Rect {
    let width = rect.width.min(area.width);
    let height = rect.height.min(area.height);
    let max_x = right(&area) - i64::from(width);
    let max_y = bottom(&area) - i64::from(height);
    Rect {
        x: i64::from(rect.x).clamp(i64::from(area.x), max_x) as i32,
        y: i64::from(rect.y).clamp(i64::from(area.y), max_y) as i32,
        width,
        height,
    }
}

fn physical(logical: f64, scale: f64) -> u32 {
    (logical * scale).round().max(1.0) as u32
}

/// Immersive: exactly the screen.
pub fn immersive_rect(screen: &Screen) -> Rect {
    screen.rect
}

/// Zoom that grows the 1280×760 composition with the screen's logical height, never below 1.
pub fn immersive_zoom(screen: &Screen) -> f64 {
    let logical_height = f64::from(screen.rect.height) / screen.scale;
    (logical_height / COMPOSITION_HEIGHT).clamp(1.0, MAX_ZOOM)
}

/// Normal window: where it was (followed if its screen moved), else centred on `screen`.
pub fn window_rect(saved: &Placement, screen: &Screen) -> Rect {
    let width = physical(WINDOW_LOGICAL.0, screen.scale);
    let height = physical(WINDOW_LOGICAL.1, screen.scale);
    let rect = match (&saved.rect, &saved.monitor) {
        (Some(r), Some(m)) if r.width > 0 && r.height > 0 => Rect {
            x: r.x - m.rect.x + screen.rect.x,
            y: r.y - m.rect.y + screen.rect.y,
            ..*r
        },
        _ => Rect {
            x: screen.work.x + ((i64::from(screen.work.width) - i64::from(width)) / 2) as i32,
            y: screen.work.y + ((i64::from(screen.work.height) - i64::from(height)) / 2) as i32,
            width,
            height,
        },
    };
    clamp_into(rect, screen.work)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(x: i32, y: i32, width: u32, height: u32) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    fn screen(name: &str, x: i32, w: u32, h: u32, scale: f64) -> Screen {
        Screen {
            name: Some(name.into()),
            rect: rect(x, 0, w, h),
            work: rect(x, 0, w, h - 48),
            scale,
        }
    }

    fn two() -> Vec<Screen> {
        vec![
            screen("D1", 0, 2560, 1440, 1.0),
            screen("D2", -2560, 2560, 1440, 1.0),
        ]
    }

    #[test]
    fn a_remembered_screen_is_found_by_name_then_by_rectangle() {
        let s = two();
        let by_name = MonitorKey {
            name: Some("D2".into()),
            rect: rect(999, 0, 1, 1),
        };
        assert_eq!(pick_screen(&s, Some(&by_name), 0), 1);
        let by_rect = MonitorKey {
            name: Some("gone".into()),
            rect: rect(-2560, 0, 2560, 1440),
        };
        assert_eq!(pick_screen(&s, Some(&by_rect), 0), 1);
        let unplugged = MonitorKey {
            name: Some("D3".into()),
            rect: rect(5120, 0, 1920, 1080),
        };
        assert_eq!(pick_screen(&s, Some(&unplugged), 0), 0, "main screen");
        assert_eq!(pick_screen(&s, None, 7), 1, "fallback index is clamped");
    }

    #[test]
    fn immersive_is_exactly_the_screen_and_grows_the_composition() {
        let s = screen("D1", 0, 2560, 1440, 1.0);
        assert_eq!(immersive_rect(&s), s.rect);
        assert_eq!(immersive_zoom(&s), 1.5, "1440/760 is capped");
        assert!((immersive_zoom(&screen("a", 0, 1366, 768, 1.0)) - 768.0 / 760.0).abs() < 1e-9);
        assert_eq!(immersive_zoom(&screen("b", 0, 2560, 1440, 2.0)), 1.0);
        assert_eq!(
            immersive_zoom(&screen("c", 0, 1920, 1080, 1.0)),
            1080.0 / 760.0
        );
    }

    #[test]
    fn the_window_opens_centred_then_where_it_was() {
        let s = &two()[0];
        let first = window_rect(&Placement::default(), s);
        assert_eq!((first.width, first.height), (1280, 760));
        assert_eq!(first.x, (2560 - 1280) / 2);
        assert_eq!(first.y, (1392 - 760) / 2);
        let saved = Placement {
            monitor: Some(s.key()),
            rect: Some(rect(100, 80, 900, 600)),
        };
        assert_eq!(window_rect(&saved, s), rect(100, 80, 900, 600));
        // Scale 150 %: the default logical size is 1920×1140 physical.
        let big = screen("D", 0, 3840, 2160, 1.5);
        let r = window_rect(&Placement::default(), &big);
        assert_eq!((r.width, r.height), (1920, 1140));
    }

    #[test]
    fn a_window_saved_on_a_screen_that_moved_or_vanished_stays_visible() {
        let moved = Screen {
            rect: rect(1000, 0, 2560, 1440),
            work: rect(1000, 0, 2560, 1392),
            ..two()[0].clone()
        };
        let saved = Placement {
            monitor: Some(MonitorKey {
                name: Some("D1".into()),
                rect: rect(0, 0, 2560, 1440),
            }),
            rect: Some(rect(50, 60, 800, 500)),
        };
        assert_eq!(window_rect(&saved, &moved), rect(1050, 60, 800, 500));
        // Saved on a big screen, restored on a small one: shrunk and moved inside.
        let small = screen("S", 0, 1366, 768, 1.0);
        let off = Placement {
            monitor: Some(small.key()),
            rect: Some(rect(1300, 700, 1280, 760)),
        };
        let r = window_rect(&off, &small);
        assert!(r.x >= 0 && r.y >= 0);
        assert!(right(&r) <= 1366 && bottom(&r) <= 720);
    }

    #[test]
    fn clamp_never_leaves_the_work_area() {
        let area = rect(0, 0, 1000, 700);
        assert_eq!(
            clamp_into(rect(-50, -10, 300, 200), area),
            rect(0, 0, 300, 200)
        );
        assert_eq!(
            clamp_into(rect(900, 650, 300, 200), area),
            rect(700, 500, 300, 200)
        );
        assert_eq!(
            clamp_into(rect(10, 10, 5000, 5000), area),
            rect(0, 0, 1000, 700)
        );
    }
}
