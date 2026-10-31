use super::regions::{physical, FLOAT_HOVER};
use super::*;

fn screen(x: i32) -> Screen {
    let rect = Rect {
        x,
        y: 0,
        width: 2560,
        height: 1440,
    };
    Screen {
        name: None,
        rect,
        work: Rect {
            height: 1392,
            ..rect
        },
        scale: 1.0,
    }
}

#[test]
fn the_island_starts_docked_in_its_place_with_its_top_on_the_edge() {
    let s = [screen(0)];
    let r = start_rect(&Placement::default(), true, Slot::Center, &s[0], &s);
    assert_eq!((r.width, r.height), (720, 420));
    assert_eq!(r.x + ANCHOR.0 as i32, 1280);
    assert_eq!(r.y + ANCHOR.1 as i32, 0);
    let r = start_rect(&Placement::default(), true, Slot::Left, &s[0], &s);
    assert_eq!(r.x + ANCHOR.0 as i32, 92, "flush with the left bezel");
}

#[test]
fn a_floating_island_comes_back_where_it_was_unless_its_screen_or_size_changed() {
    let s = [screen(0), screen(-2560)];
    let left = Rect {
        x: -1500,
        y: 600,
        width: 720,
        height: 420,
    };
    let saved = Placement {
        monitor: None,
        rect: Some(left),
    };
    assert_eq!(start_rect(&saved, false, Slot::Center, &s[0], &s), left);
    let gone = Placement {
        monitor: None,
        rect: Some(Rect { x: 9000, ..left }),
    };
    assert_eq!(
        start_rect(&gone, false, Slot::Center, &s[0], &s).y + ANCHOR.1 as i32,
        0
    );
    // A place saved by an older, smaller window: docked instead of off by its difference.
    let older = Placement {
        monitor: None,
        rect: Some(Rect {
            width: 560,
            height: 260,
            ..left
        }),
    };
    assert_eq!(
        start_rect(&older, false, Slot::Center, &s[0], &s).y + ANCHOR.1 as i32,
        0
    );
}

#[test]
fn the_click_region_holds_the_hovered_island_and_never_its_flush_sides() {
    let r = rest_region(true, Slot::Center, 1.0);
    assert_eq!((r.x, r.y, r.width, r.height), (248, 150, 224, 36));
    let l = rest_region(true, Slot::Left, 1.0);
    assert_eq!(l.x, 360 - 92, "starts at the bezel");
    let rr = rest_region(true, Slot::Right, 1.0);
    assert_eq!(rr.x + rr.width, 360 + 92, "ends at the bezel");
    let f = rest_region(false, Slot::Center, 1.5);
    assert!(f.width > physical(FLOAT_HOVER.0, 1.5) && f.round > 0);
    let m = moving_region(1.0);
    assert_eq!((m.x, m.width), (2, 716), "the window's edges never show");
}
