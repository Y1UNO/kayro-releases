use super::*;
use crate::config::ui_state::Rect;
use crate::desktop::island::slots::corner_of;

fn screen(x: i32, width: u32) -> Screen {
    let rect = Rect {
        x,
        y: 0,
        width,
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

/// The test machine: a second screen on the left of the main one.
fn two() -> Vec<Screen> {
    vec![screen(0, 2560), screen(-2560, 2560)]
}

const FORCE: IslandPassage = IslandPassage::Force;

fn docked(s: &[Screen], slot: Slot, cursor: V2) -> Gesture {
    Gesture::new(
        slot_anchor(&s[0], slot),
        cursor,
        true,
        slot,
        0,
        1.0,
        false,
        FORCE,
    )
}

fn floating(at: V2) -> Gesture {
    Gesture::new(at, at, false, Slot::Center, 0, 1.0, false, FORCE)
}

fn gliding(at: V2) -> Gesture {
    Gesture::new(
        at,
        at,
        false,
        Slot::Center,
        0,
        1.0,
        false,
        IslandPassage::Glitch,
    )
}

/// Steps at 144 Hz for `secs`, the cursor at `cursor`.
fn run(g: &mut Gesture, screens: &[Screen], cursor: V2, held: bool, secs: f64) -> Vec<Moment> {
    let mut all = Vec::new();
    let mut t = 0.0;
    while t < secs {
        let step = g.step(screens, cursor, held, 1.0 / 144.0);
        all.extend(step.moments);
        if step.done {
            break;
        }
        t += 1.0 / 144.0;
    }
    all
}

#[test]
fn a_spring_reaches_its_target_and_the_dock_one_overshoots_once() {
    let (mut p, mut v) = (V2::default(), V2::default());
    let mut lowest = 0.0f64;
    for _ in 0..288 {
        DOCK.step(&mut p, &mut v, V2::new(0.0, -100.0), 1.0 / 144.0);
        lowest = lowest.min(p.y);
    }
    assert!((p.y + 100.0).abs() < 0.5);
    assert!(lowest < -101.0, "one overshoot into the bezel");
    let (mut p, mut v) = (V2::default(), V2::default());
    let mut lowest = 0.0f64;
    for _ in 0..288 {
        CALM.step(&mut p, &mut v, V2::new(0.0, -100.0), 1.0 / 144.0);
        lowest = lowest.min(p.y);
    }
    assert!(lowest >= -100.01, "reduce motion: no overshoot");
}

#[test]
fn the_rubber_band_never_passes_its_limit() {
    assert_eq!(rubber(0.0, 20.0), 0.0);
    assert!(rubber(10.0, 20.0) < 10.0);
    assert!(rubber(10_000.0, 20.0) < 20.0);
    assert_eq!(rubber(-30.0, 20.0), -rubber(30.0, 20.0));
}

#[test]
fn a_short_pull_stretches_the_notch_and_a_long_one_tears_it_off() {
    let s = two();
    let home = slot_anchor(&s[0], Slot::Center);
    let press = V2::new(home.x, 16.0);
    let mut g = docked(&s, Slot::Center, press);
    let step = g.step(&s, V2::new(press.x, 16.0 + 30.0), true, 1.0 / 144.0);
    assert_eq!(step.anchor, home, "held on the edge");
    assert!(step.look.tension > 0.5 && step.look.tension < 1.0);
    assert!(step.look.pull.y > 0.0 && step.look.pull.y < 30.0);
    let step = g.step(&s, V2::new(press.x, 16.0 + DETACH + 1.0), true, 1.0 / 144.0);
    assert!(step.moments.contains(&Moment::Detached));
    assert_eq!(g.phase, Phase::Free);
}

#[test]
fn a_press_without_a_pull_is_a_tap() {
    let s = two();
    let home = slot_anchor(&s[0], Slot::Center);
    let mut g = docked(&s, Slot::Center, home);
    let step = g.step(&s, V2::new(home.x + 2.0, 1.0), false, 1.0 / 144.0);
    assert_eq!(step.moments, vec![Moment::Tap]);
    assert!(step.done);
}

#[test]
fn a_sideways_pull_slides_it_along_the_top_edge_into_a_corner() {
    let s = two();
    let home = slot_anchor(&s[0], Slot::Center);
    let mut g = docked(&s, Slot::Center, home);
    // Well past the right corner: it stops there, squashed against the side.
    let far = V2::new(home.x + 1600.0, 4.0);
    let moments = run(&mut g, &s, far, true, 1.0);
    assert!(moments.is_empty(), "still on the edge");
    let right = slot_anchor(&s[0], Slot::Right);
    assert!((g.p.x - right.x).abs() < 1.0 && g.p.y == right.y);
    let step = g.step(&s, far, true, 1.0 / 144.0);
    assert!(step.look.pull.x > 0.0 && step.look.corner > 0.99);
    let moments = run(&mut g, &s, far, false, 3.0);
    assert!(moments.contains(&Moment::Snapped { slot: Slot::Right }));
    assert_eq!(
        moments.last(),
        Some(&Moment::Settled {
            docked: true,
            slot: Slot::Right
        })
    );
}

#[test]
fn a_slide_let_go_halfway_snaps_to_the_nearest_place() {
    let s = two();
    let home = slot_anchor(&s[0], Slot::Center);
    let mut g = docked(&s, Slot::Center, home);
    run(&mut g, &s, V2::new(400.0, 4.0), true, 1.0);
    let moments = run(&mut g, &s, V2::new(400.0, 4.0), false, 3.0);
    assert_eq!(
        moments.last(),
        Some(&Moment::Settled {
            docked: true,
            slot: Slot::Left
        })
    );
    assert_eq!(g.p, slot_anchor(&s[0], Slot::Left));
}

#[test]
fn let_go_near_the_top_it_docks_at_the_nearest_place_and_touches_the_bezel_first() {
    let s = two();
    for (x, slot) in [
        (700.0, Slot::Center),
        (200.0, Slot::Left),
        (2400.0, Slot::Right),
    ] {
        let start = V2::new(x, 500.0);
        let mut g = floating(start);
        run(&mut g, &s, V2::new(x, 60.0), true, 0.5);
        let moments = run(&mut g, &s, V2::new(x, 60.0), false, 3.0);
        assert_eq!(moments.first(), Some(&Moment::Docking));
        assert!(moments.contains(&Moment::Touched));
        assert_eq!(
            moments.last(),
            Some(&Moment::Settled { docked: true, slot })
        );
        assert_eq!(g.p, slot_anchor(&s[0], slot));
    }
}

#[test]
fn let_go_lower_it_stays_where_it_was_put() {
    let s = two();
    let mut g = floating(V2::new(600.0, 500.0));
    run(&mut g, &s, V2::new(900.0, 700.0), true, 0.5);
    let moments = run(&mut g, &s, V2::new(900.0, 700.0), false, 3.0);
    assert_eq!(moments.first(), Some(&Moment::Dropped));
    assert!(matches!(
        moments.last(),
        Some(Moment::Settled { docked: false, .. })
    ));
    assert!((g.p.x - 900.0).abs() < 1.0 && (g.p.y - 700.0).abs() < 1.0);
}

#[test]
fn the_magnet_pulls_towards_the_top_edge_only_in_its_zone() {
    let s = two();
    let mut g = floating(V2::new(600.0, 500.0));
    let far = g.step(&s, V2::new(600.0, 400.0), true, 1.0 / 144.0);
    assert_eq!(far.look.near, 0.0);
    run(&mut g, &s, V2::new(600.0, 30.0), true, 1.0);
    assert!(g.p.y < 30.0, "pulled up a little");
}

#[test]
fn the_screen_edge_holds_it_inside_until_it_is_forced_then_lets_through() {
    let s = two();
    let mut g = floating(V2::new(400.0, 600.0));
    let half = FLOAT_SIZE.0 / 2.0;
    // Pushed 60 px past the left edge: it stays inside its screen (never across), squashed.
    let moments = run(&mut g, &s, V2::new(half - 60.0, 600.0), true, 1.0);
    assert!(moments.is_empty());
    assert_eq!(g.screen, 0);
    assert!(
        (g.p.x - half).abs() < 1.0,
        "its edge on the screen's edge, not past it"
    );
    let step = g.step(&s, V2::new(half - 60.0, 600.0), true, 1.0 / 144.0);
    assert!(step.look.pull.x < -10.0 && step.look.pull.x > -PUSH_SHOWN);
    // Forced harder: through to the left screen.
    let moments = run(&mut g, &s, V2::new(half - BREAK - 20.0, 600.0), true, 1.0);
    assert!(matches!(moments.first(), Some(Moment::Crossed { dir }) if dir.x < -0.9));
    assert_eq!(g.screen, 1);
    assert!(g.p.x < 0.0);
}

#[test]
fn the_outer_edge_of_the_desk_is_a_wall() {
    let s = two();
    let mut g = floating(V2::new(2000.0, 600.0));
    let moments = run(&mut g, &s, V2::new(4000.0, 600.0), true, 1.0);
    assert!(moments.is_empty());
    assert!(g.p.x <= 2560.0 - FLOAT_SIZE.0 / 2.0 + 0.5);
}

#[test]
fn the_places_on_the_top_edge_follow_the_taskbar_and_the_corners() {
    let mut s = screen(0, 1920);
    s.work = Rect {
        x: 0,
        y: 48,
        width: 1920,
        height: 1032,
    };
    assert_eq!(slot_anchor(&s, Slot::Center), V2::new(960.0, 48.0));
    assert_eq!(slot_anchor(&s, Slot::Left).x, 92.0);
    assert_eq!(slot_anchor(&s, Slot::Right).x, 1920.0 - 92.0);
    assert_eq!(corner_at(&s, 92.0), -1.0);
    assert_eq!(corner_at(&s, 960.0), 0.0);
    assert_eq!(corner_at(&s, 1828.0), 1.0);
    assert_eq!(nearest_slot(&s, 300.0), Slot::Left);
    assert_eq!(corner_of(Slot::Right), 1.0);
}

#[test]
fn glitch_nothing_holds_it_between_two_screens_and_the_seam_is_told() {
    let s = two();
    let mut g = gliding(V2::new(400.0, 600.0));
    // Across the edge with the left screen: it follows, no push to show.
    run(&mut g, &s, V2::new(30.0, 600.0), true, 1.0);
    assert!((g.p.x - 30.0).abs() < 1.0);
    let step = g.step(&s, V2::new(30.0, 600.0), true, 1.0 / 144.0);
    assert_eq!(step.look.pull.x, 0.0);
    assert_eq!(
        step.look.seam,
        (Some(0.0), None),
        "the edge cuts through it"
    );
    // Its centre over the left screen: a crossing, then it can rest across both.
    let moments = run(&mut g, &s, V2::new(-30.0, 600.0), true, 1.0);
    assert!(matches!(moments.first(), Some(Moment::Crossed { dir }) if dir.x < -0.9));
    assert_eq!(g.screen, 1);
    let moments = run(&mut g, &s, V2::new(-30.0, 600.0), false, 3.0);
    assert!(matches!(
        moments.last(),
        Some(Moment::Settled { docked: false, .. })
    ));
    assert!((g.p.x + 30.0).abs() < 1.0, "left across the two screens");
    // At rest, its frames still tell the edge under it (the glitch goes on).
    let last = g.step(&s, V2::new(-30.0, 600.0), false, 1.0 / 144.0);
    assert_eq!(last.look.seam, (Some(0.0), None));
}

#[test]
fn glitch_the_outer_edges_still_hold() {
    let s = two();
    let mut g = gliding(V2::new(2000.0, 600.0));
    run(&mut g, &s, V2::new(4000.0, 600.0), true, 1.0);
    assert!(g.p.x <= 2560.0 - FLOAT_SIZE.0 / 2.0 + 0.5);
    let step = g.step(&s, V2::new(4000.0, 600.0), true, 1.0 / 144.0);
    assert!(step.look.pull.x > 0.0 && step.look.seam == (None, None));
}

#[test]
fn a_settle_carries_the_island_without_a_hand() {
    let s = two();
    let mut g = Gesture::settle(
        V2::new(2500.0, 1300.0),
        V2::new(2300.0, 1100.0),
        0,
        1.0,
        false,
    );
    let moments = run(&mut g, &s, V2::new(0.0, 0.0), false, 3.0);
    assert!(matches!(
        moments.last(),
        Some(Moment::Settled { docked: false, .. })
    ));
    assert_eq!(g.p, V2::new(2300.0, 1100.0));
}

#[test]
fn flying_to_the_top_edge_it_tells_how_near_it_is_up_to_the_touch() {
    let s = two();
    let mut g = floating(V2::new(700.0, 500.0));
    run(&mut g, &s, V2::new(700.0, 60.0), true, 0.5);
    let mut nears = Vec::new();
    for _ in 0..432 {
        let step = g.step(&s, V2::new(700.0, 60.0), false, 1.0 / 144.0);
        nears.push(step.look.near);
        if step.moments.contains(&Moment::Touched) || step.done {
            break;
        }
    }
    // The page's threads tighten as it flies up, and are full at the touch.
    assert!(nears.last().is_some_and(|&n| n > 0.99));
    assert!(nears.iter().all(|n| (0.0..=1.0).contains(n)));
}
