use super::*;

/// A 16:9 screen.
const WIDE: f32 = 9.0 / 16.0;

fn seen(index_cm: f32, right_cm: f32) -> Seen {
    Seen {
        anchor: [0.5, 0.40],
        index_cm,
        right_cm,
        pointing: true,
        index_reach: 1.0,
        thumb_up: false,
    }
}

fn at(x: f32, index_cm: f32) -> Option<Seen> {
    Some(Seen {
        anchor: [x, 0.40],
        ..seen(index_cm, 7.0)
    })
}

fn pointer() -> Pointer {
    Pointer::new(1.0, WIDE)
}

/// Runs frames 40 ms apart from `t0`, returns what came out.
fn run(p: &mut Pointer, t0: f64, frames: &[Option<Seen>]) -> Vec<Act> {
    let mut out = Vec::new();
    for (i, f) in frames.iter().enumerate() {
        p.step(f.as_ref(), t0 + i as f64 * 0.04, &mut out);
    }
    out
}

fn buttons(acts: &[Act]) -> Vec<Act> {
    acts.iter()
        .copied()
        .filter(|a| !matches!(a, Act::MoveTo(_)))
        .collect()
}

fn moves(acts: &[Act]) -> Vec<[f32; 2]> {
    acts.iter()
        .filter_map(|a| {
            if let Act::MoveTo(m) = a {
                Some(*m)
            } else {
                None
            }
        })
        .collect()
}

#[test]
fn a_pinch_is_a_left_click_and_its_two_thresholds_stop_any_flicker() {
    let mut p = pointer();
    let frames: Vec<_> = [4.0, 2.5, 2.0, 2.7, 2.6, 2.8, 3.5, 2.6, 3.4, 3.3]
        .iter()
        .map(|&d| Some(seen(d, 7.0)))
        .collect();
    let acts = run(&mut p, 0.0, &frames);
    assert_eq!(
        buttons(&acts),
        [Act::Down(Button::Left), Act::Up(Button::Left)]
    );
    assert_eq!(p.grip(), Grip::Free);
}

#[test]
fn the_ring_pinch_is_a_right_click_only_with_the_index_apart() {
    let mut p = pointer();
    let acts = run(
        &mut p,
        0.0,
        &[
            Some(seen(6.5, 6.0)),
            Some(seen(6.5, 2.0)),
            Some(seen(6.5, 2.2)),
            Some(seen(6.5, 5.0)),
        ],
    );
    assert_eq!(
        buttons(&acts),
        [Act::Down(Button::Right), Act::Up(Button::Right)]
    );
    let mut p = pointer();
    let acts = run(&mut p, 0.0, &[Some(seen(3.5, 2.0)), Some(seen(3.5, 2.0))]);
    assert!(buttons(&acts).is_empty());
}

#[test]
fn a_hand_that_leaves_lets_its_button_go() {
    let mut p = pointer();
    let acts = run(
        &mut p,
        0.0,
        &[Some(seen(4.0, 7.0)), Some(seen(1.5, 7.0)), None],
    );
    assert_eq!(
        buttons(&acts),
        [Act::Down(Button::Left), Act::Up(Button::Left)]
    );
}

#[test]
fn the_cursor_is_where_the_hand_is() {
    // The zone's middle is the screen's middle, whatever the hand did before.
    let mut p = pointer();
    let mut frames: Vec<_> = (0..20).map(|i| at(0.3 + 0.01 * i as f32, 6.0)).collect();
    frames.extend((0..40).map(|_| at(0.5, 6.0)));
    let last = *moves(&run(&mut p, 0.0, &frames)).last().unwrap();
    assert!((last[0] - 0.5).abs() < 0.01, "{last:?}");
    // Edges clamp; the zone has the screen's proportions.
    assert_eq!(to_screen([0.0, 0.0], 1.0, WIDE), [0.0, 0.0]);
    assert_eq!(to_screen([1.0, 1.0], 1.0, WIDE), [1.0, 1.0]);
    let up = to_screen([0.5, 0.40 - 0.05], 1.0, WIDE)[1] - 0.5;
    let right = to_screen([0.55, 0.40], 1.0, WIDE)[0] - 0.5;
    assert!((up.abs() - right / WIDE).abs() < 1e-4, "{up} {right}");
}

#[test]
fn a_fist_neither_moves_nor_clicks() {
    let mut p = pointer();
    let fist = |x: f32| {
        Some(Seen {
            anchor: [x, 0.40],
            pointing: false,
            index_reach: 0.3,
            ..seen(1.5, 2.0)
        })
    };
    let acts = run(&mut p, 0.0, &[fist(0.45), fist(0.5), fist(0.55)]);
    assert!(acts.is_empty(), "{acts:?}");
}

#[test]
fn the_cursor_stands_still_while_a_pinch_closes() {
    let mut p = pointer();
    let acts = run(
        &mut p,
        0.0,
        &[
            at(0.40, 5.0),
            at(0.45, 5.0),
            at(0.46, 2.0),
            at(0.47, 2.0),
            at(0.48, 2.0),
        ],
    );
    let i = acts
        .iter()
        .position(|a| *a == Act::Down(Button::Left))
        .unwrap();
    assert!(
        acts[i + 1..].iter().all(|a| !matches!(a, Act::MoveTo(_))),
        "{acts:?}"
    );
    // Once it has passed, the drag moves the cursor.
    let more = run(&mut p, 0.20, &[at(0.55, 2.0), at(0.60, 2.0)]);
    assert!(!moves(&more).is_empty());
}

#[test]
fn a_small_slow_move_is_seen_and_a_resting_hand_is_steady() {
    // Jitter of ±0.002 image width (about 1 px of a 640 camera) around a resting point.
    let mut p = pointer();
    let frames: Vec<_> = (0..60)
        .map(|i| at(if i % 2 == 0 { 0.502 } else { 0.498 }, 6.0))
        .collect();
    let rest = moves(&run(&mut p, 0.0, &frames));
    let spread = rest
        .iter()
        .skip(20)
        .map(|m| (m[0] - 0.5).abs())
        .fold(0.0, f32::max);
    // Raw, ±0.005 of the screen (9 px on 1920); smoothed, under 2 px.
    assert!(spread < 0.001, "{spread}");
    // One centimetre or so (0.01 image width) in a second: the cursor follows it.
    let slow: Vec<_> = (0..=25)
        .map(|i| at(0.5 + 0.01 * i as f32 / 25.0, 6.0))
        .chain((0..15).map(|_| at(0.51, 6.0)))
        .collect();
    let last = *moves(&run(&mut p, 2.4, &slow)).last().unwrap();
    let expected = to_screen([0.51, 0.40], 1.0, WIDE)[0];
    assert!((last[0] - expected).abs() < 0.003, "{last:?} vs {expected}");
}

#[test]
fn a_glitch_of_the_model_does_not_throw_the_cursor() {
    let mut p = pointer();
    let acts = run(
        &mut p,
        0.0,
        &[
            at(0.5, 6.0),
            at(0.5, 6.0),
            at(0.8, 1.0),
            at(0.5, 6.0),
            at(0.5, 6.0),
        ],
    );
    assert!(buttons(&acts).is_empty(), "{acts:?}");
    assert!(
        moves(&acts).iter().all(|m| (m[0] - 0.5).abs() < 0.01),
        "{acts:?}"
    );
}

#[test]
fn a_thumb_up_held_a_second_turns_the_hands_off() {
    let mut p = pointer();
    let up = Some(Seen {
        thumb_up: true,
        pointing: false,
        ..seen(6.0, 6.0)
    });
    let acts = run(&mut p, 0.0, &[up; 13]);
    assert!(acts.is_empty(), "{acts:?}");
    let acts = run(&mut p, 0.52, &[up; 14]);
    assert_eq!(acts, [Act::Off]);
}

#[test]
fn a_pinch_with_the_index_bent_clicks_and_drags() {
    // The user's natural pinch: the index bends to meet the thumb (not "pointing").
    let bent = |x: f32, d: f32| {
        Some(Seen {
            anchor: [x, 0.40],
            pointing: false,
            index_reach: 0.8,
            ..seen(d, 7.0)
        })
    };
    let mut p = pointer();
    let acts = run(&mut p, 0.0, &[at(0.5, 5.0), bent(0.5, 1.8), bent(0.5, 1.6)]);
    assert_eq!(buttons(&acts), [Act::Down(Button::Left)]);
    // After the freeze, the drag follows the hand.
    let more = run(
        &mut p,
        0.4,
        &[bent(0.55, 1.6), bent(0.60, 1.6), bent(0.62, 1.6)],
    );
    assert!(!moves(&more).is_empty(), "{more:?}");
}

#[test]
fn a_held_ring_pinch_that_wavers_does_not_flicker() {
    let mut p = pointer();
    let frames: Vec<_> = [6.0, 2.0, 3.0, 3.5, 2.2, 3.6, 2.4, 3.2, 4.0, 4.1]
        .iter()
        .map(|&d| Some(seen(6.5, d)))
        .collect();
    let acts = run(&mut p, 0.0, &frames);
    assert_eq!(
        buttons(&acts),
        [Act::Down(Button::Right), Act::Up(Button::Right)]
    );
    let up = acts
        .iter()
        .position(|a| *a == Act::Up(Button::Right))
        .unwrap();
    // Only after the two frames over 3.8 at the end.
    assert_eq!(acts.len() - 1, up, "{acts:?}");
}

#[test]
fn pushing_past_an_edge_goes_to_the_next_screen_once() {
    let mut p = pointer();
    let mut frames: Vec<_> = [0.5, 0.6, 0.7].iter().map(|&x| at(x, 6.0)).collect();
    frames.extend((0..25).map(|_| at(0.78, 6.0)));
    let acts = run(&mut p, 0.0, &frames);
    let crossings: Vec<_> = acts.iter().filter(|a| matches!(a, Act::Cross(_))).collect();
    assert_eq!(crossings, [&Act::Cross([1, 0])], "{acts:?}");
    // A hand that only passes by the edge does not cross.
    let mut q = pointer();
    let mut quick: Vec<_> = [0.5, 0.6, 0.7, 0.78, 0.78]
        .iter()
        .map(|&x| at(x, 6.0))
        .collect();
    quick.extend([0.7, 0.6, 0.5].iter().map(|&x| at(x, 6.0)));
    assert!(!run(&mut q, 0.0, &quick)
        .iter()
        .any(|a| matches!(a, Act::Cross(_))));
    // Back inside, a new push crosses again.
    let back: Vec<_> = [0.7, 0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.6, 0.7]
        .iter()
        .map(|&x| at(x, 6.0))
        .chain((0..25).map(|_| at(0.78, 6.0)))
        .collect();
    let again = run(&mut p, 2.0, &back);
    assert!(again.iter().any(|a| *a == Act::Cross([1, 0])), "{again:?}");
}
