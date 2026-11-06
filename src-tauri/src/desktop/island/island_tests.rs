use super::outline::inside;
use super::regions::{physical, rest_region_for, Footprint, FLOAT_HOVER};
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
    // 204 × 36, its 10 px shoulders, 1 px around it (not above: the bezel).
    assert_eq!((r.x, r.y, r.width, r.height), (247, 150, 226, 37));
    let l = rest_region(true, Slot::Left, 1.0);
    assert_eq!(l.x, 360 - 92, "starts at the bezel");
    let rr = rest_region(true, Slot::Right, 1.0);
    assert_eq!(rr.x + rr.width, 360 + 92, "ends at the bezel");
    let f = rest_region(false, Slot::Center, 1.5);
    assert!(f.width > physical(FLOAT_HOVER.0, 1.5) && f.round > 0);
    let m = moving_region(1.0);
    assert_eq!((m.x, m.width), (2, 716), "the window's edges never show");
}

#[test]
fn the_docked_click_region_is_the_island_s_exact_shape() {
    let small = Footprint {
        docked: (184.0, 32.0),
        floating: (176.0, 44.0),
    };
    // Centred: 268 → 452, its top at 150, its bottom at 182 rounded by 16.
    let r = rest_region_for(small, true, Slot::Center, 1.0);
    assert_eq!((r.x, r.y, r.width, r.height), (257, 150, 206, 33));
    let o = &r.outline;
    assert!(inside(o, (360.0, 165.0)), "the island");
    assert!(inside(o, (360.0, 182.5)), "its bottom edge, within a pixel");
    assert!(!inside(o, (360.0, 185.0)), "under it");
    assert!(
        !inside(o, (269.0, 181.0)),
        "beside its rounded bottom corner"
    );
    assert!(!inside(o, (451.0, 181.0)), "beside the other one");
    assert!(inside(o, (265.0, 151.0)), "a shoulder, along the bezel");
    assert!(!inside(o, (259.0, 158.0)), "under a shoulder's curve");
    assert!(!inside(o, (255.0, 151.0)), "past the shoulder");
    // Scaled for the screen, the same shape.
    let big = rest_region_for(small, true, Slot::Center, 1.5);
    assert!(inside(&big.outline, (540.0, 247.0)));
    assert!(!inside(&big.outline, (403.0, 271.0)));
}

#[test]
fn the_click_region_follows_the_island_as_drawn_now() {
    let small = Footprint {
        docked: (184.0, 32.0),
        floating: (176.0, 44.0),
    };
    // Wider with music and a launch, taller hovered with its dots: the region follows.
    let big = Footprint {
        docked: (378.0, 62.0),
        ..small
    };
    let b = rest_region_for(big, true, Slot::Center, 1.0);
    assert_eq!((b.width, b.height), (378 + 2 + 20, 63));
    // In a corner, it grows away from the bezel only; its shoulder is below its flush side.
    let l = rest_region_for(big, true, Slot::Left, 1.0);
    assert_eq!((l.x, l.x + l.width), (268, 268 + 378 + 1 + 10));
    assert!(inside(&l.outline, (270.0, 215.0)), "the shoulder below it");
    assert!(
        inside(&l.outline, (269.0, 211.0)),
        "its square flush corner"
    );
    assert!(
        !inside(&l.outline, (645.0, 211.0)),
        "beside its rounded corner"
    );
    let rr = rest_region_for(big, true, Slot::Right, 1.0);
    assert_eq!((rr.x, rr.x + rr.width), (452 - 378 - 1 - 10, 452));
    assert!(inside(&rr.outline, (450.0, 215.0)));
    assert!(!inside(&rr.outline, (75.0, 211.0)));
    // Floating: the capsule and what its shadow reaches, scaled for the screen.
    let f = rest_region_for(small, false, Slot::Center, 1.5);
    assert_eq!((f.x, f.y, f.width, f.height), (393, 216, 294, 96));
    assert_eq!(f.round, f.height);
    assert!(f.outline.is_empty());
}
