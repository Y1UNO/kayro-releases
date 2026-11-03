//! The music analysis on synthetic sounds (music_sounds.rs).

use std::f32::consts::TAU;

use super::sounds::{gaps, kit, run, song, Mix, Run};
use super::*;

#[test]
fn kicks_are_found_on_time_and_keep_their_refractory_time() {
    let mut m = Mix::new(4.5);
    let onsets: Vec<f32> = (0..8).map(|i| 0.3 + 0.5 * i as f32).collect();
    for &t in &onsets {
        m.add(t, &kit().kick, 0.8);
    }
    let r = run(&m.0);
    let kicks = r.of(HitKind::Kick);
    assert_eq!(kicks.len(), onsets.len(), "{:?}", r.hits);
    for ((found, v), onset) in kicks.iter().zip(&onsets) {
        let late = found - onset;
        assert!(
            (0.0..0.025).contains(&late),
            "kick at {onset} found {late} s later"
        );
        assert!(*v > 0.8, "{v}");
    }
    let others: Vec<_> = r
        .hits
        .iter()
        .filter(|(_, h)| h.kind != HitKind::Kick)
        .collect();
    assert!(others.is_empty(), "a kick alone is only a kick: {others:?}");
    // Two kicks 60 ms apart: one hit (110 ms refractory); 150 ms apart: two.
    for (gap, expected) in [(0.06, 1), (0.15, 2)] {
        let mut m = Mix::new(1.0);
        m.add(0.3, &kit().kick, 0.8);
        m.add(0.3 + gap, &kit().kick, 0.8);
        let kicks = run(&m.0).of(HitKind::Kick);
        assert_eq!(kicks.len(), expected, "{gap} s apart: {kicks:?}");
    }
}

#[test]
fn hi_hats_are_hi_hats_not_kicks() {
    let mut m = Mix::new(3.5);
    for i in 0..24 {
        m.add(0.3 + 0.125 * i as f32, &kit().hat, 0.3);
    }
    let r = run(&m.0);
    assert!(r.of(HitKind::Hat).len() >= 23, "{:?}", r.hits);
    let others: Vec<_> = r
        .hits
        .iter()
        .filter(|(_, h)| h.kind != HitKind::Hat)
        .collect();
    assert!(others.is_empty(), "{others:?}");
}

#[test]
fn a_steady_groove_gives_its_three_instruments_and_no_crash() {
    let mut m = Mix::new(8.0);
    m.groove(0.25, 8.0, 1.0);
    let r = run(&m.0);
    let after = |kind| r.of(kind).into_iter().filter(|(t, _)| *t > 2.0).count();
    // From 2 s to 8 s: 12 kicks, 6 snares, 24 hi-hats.
    assert!(
        (11..=13).contains(&after(HitKind::Kick)),
        "{:?}",
        r.of(HitKind::Kick)
    );
    assert!(
        (5..=7).contains(&after(HitKind::Snare)),
        "{:?}",
        r.of(HitKind::Snare)
    );
    assert!(after(HitKind::Hat) >= 22, "{:?}", r.of(HitKind::Hat));
    assert!(
        r.of(HitKind::Crash).is_empty(),
        "{:?}",
        r.of(HitKind::Crash)
    );
}

#[test]
fn a_song_gives_its_kicks_snares_and_hi_hats_and_little_else() {
    for real in [false, true] {
        let s = song(real);
        let r = run(&s.mix.0);
        let (kicks, stray_kicks) = r.score(HitKind::Kick, &s.kicks);
        let (snares, stray_snares) = r.score(HitKind::Snare, &s.snares);
        let (hats, stray_hats) = r.score(HitKind::Hat, &s.hats);
        let tally = format!("real {real}: kicks {kicks}+{stray_kicks}, snares {snares}+{stray_snares}, hats {hats}+{stray_hats}");
        assert!(kicks >= 31 && stray_kicks <= 4, "{tally}");
        assert!(snares == 16 && stray_snares <= 3, "{tally}");
        assert!(hats >= 60 && stray_hats <= 2, "{tally}");
        assert!(r.of(HitKind::Crash).is_empty(), "{tally}");
    }
}

#[test]
fn a_wide_crash_comes_at_most_once_in_0_9_s() {
    let mut m = Mix::new(9.0);
    m.groove(0.25, 9.0, 0.6);
    for i in 0..10 {
        m.add(4.0 + 0.4 * i as f32, &kit().crash, 0.7);
    }
    let r = run(&m.0);
    let crashes = r.of(HitKind::Crash);
    assert!(!crashes.is_empty(), "{:?}", r.hits);
    assert!(crashes[0].0 >= 4.0 && crashes[0].0 < 4.05, "{crashes:?}");
    assert!(gaps(&crashes).iter().all(|g| *g >= 0.9), "{crashes:?}");
}

#[test]
fn a_drop_after_a_quiet_passage_is_a_crash() {
    let mut m = Mix::new(9.0);
    m.groove(0.25, 5.0, 0.1);
    m.groove(5.0, 9.0, 1.0);
    let r = run(&m.0);
    let crashes = r.of(HitKind::Crash);
    assert_eq!(crashes.len(), 1, "{crashes:?}");
    let (t, v) = crashes[0];
    assert!((5.0..5.4).contains(&t) && v == 1.0, "{crashes:?}");
    assert!(r.between(5.5, 7.0).all(|l| l.section == Section::Drop));
}

#[test]
fn a_build_then_a_gap_then_the_drop() {
    let mut m = Mix::new(14.0);
    m.groove(0.25, 5.0, 0.6);
    // The build: no kick, a hi-hat roll getting louder for 4 s, then 0.5 s of silence.
    for i in 0..32 {
        m.add(5.0 + 0.125 * i as f32, &kit().hat, 0.04 + 0.02 * i as f32);
    }
    m.groove(9.5, 14.0, 1.0);
    let r = run(&m.0);
    let build = |a, b| r.between(a, b).map(|l| l.build).fold(0.0, f32::max);
    assert!(build(8.5, 9.0) > 0.3, "{}", build(8.5, 9.0));
    assert!(r.between(9.2, 9.45).any(|l| l.gap), "the gap");
    assert!(r.between(8.6, 9.0).all(|l| l.section == Section::Build));
    let crashes = r.of(HitKind::Crash);
    let drop = |(t, v): &(f32, f32)| (9.5..9.8).contains(t) && *v == 1.0;
    assert!(crashes.iter().any(drop), "{crashes:?}");
    assert!(build(10.5, 14.0) < 0.05 && r.between(10.0, 14.0).all(|l| !l.gap));
}

#[test]
fn the_sub_follows_a_low_sine() {
    let mut m = Mix::new(4.0);
    m.tone(0.5, 2.0, 45.0, 0.5);
    m.tone(2.0, 3.0, 45.0, 0.25);
    let r = run(&m.0);
    let low = |a, b| r.between(a, b).map(|l| l.sub).fold(f32::MAX, f32::min);
    let high = |a, b| r.between(a, b).map(|l| l.sub).fold(0.0, f32::max);
    assert!(low(0.7, 1.9) > 0.9, "{}", low(0.7, 1.9));
    assert!(low(2.3, 2.9) > 0.35 && high(2.3, 2.9) < 0.65);
    assert!(high(3.5, 4.0) < 0.1, "{}", high(3.5, 4.0));
}

#[test]
fn the_melody_follows_a_tone_and_not_the_drums() {
    let mut m = Mix::new(7.0);
    for i in 0..14 {
        let t = 0.25 + 0.5 * i as f32;
        m.add(t, &kit().kick, 0.8);
        m.add(t + 0.25, &kit().hat, 0.2);
    }
    m.tone(3.0, 4.5, 440.0, 0.2);
    m.tone(4.5, 5.5, 1760.0, 0.2);
    let r = run(&m.0);
    let top = |a, b| r.between(a, b).map(|l| l.melody).fold(0.0, f32::max);
    let low = |a, b| r.between(a, b).map(|l| l.melody).fold(f32::MAX, f32::min);
    let pitch = |a, b| r.between(a, b).map(|l| l.pitch).fold(0.0, f32::max);
    assert!(top(1.0, 3.0) < 0.2, "drums alone: {}", top(1.0, 3.0));
    assert!(low(3.2, 4.5) > 0.7, "the tone: {}", low(3.2, 4.5));
    let a440 = (440.0f32 / 250.0).ln() / 16f32.ln();
    let a1760 = (1760.0f32 / 250.0).ln() / 16f32.ln();
    assert!(
        (pitch(4.0, 4.5) - a440).abs() < 0.05,
        "{} {a440}",
        pitch(4.0, 4.5)
    );
    assert!(
        (pitch(5.2, 5.5) - a1760).abs() < 0.05,
        "{} {a1760}",
        pitch(5.2, 5.5)
    );
    assert!(top(6.4, 7.0) < 0.2, "after the tone: {}", top(6.4, 7.0));
}

#[test]
fn the_same_groove_20_db_quieter_hits_alike() {
    let mut loud = Mix::new(7.0);
    loud.groove(0.25, 7.0, 1.0);
    let quiet = Mix(loud.0.iter().map(|s| s * 0.1).collect());
    let (a, b) = (run(&loud.0), run(&quiet.0));
    for kind in [HitKind::Kick, HitKind::Snare, HitKind::Hat] {
        let stats = |r: &Run| {
            let late: Vec<f32> = r
                .of(kind)
                .iter()
                .filter(|(t, _)| *t > 2.0)
                .map(|h| h.1)
                .collect();
            (
                late.len(),
                late.iter().sum::<f32>() / late.len().max(1) as f32,
            )
        };
        let ((n1, v1), (n2, v2)) = (stats(&a), stats(&b));
        assert!(n1.abs_diff(n2) <= 1 && n1 > 0, "{kind:?}: {n1} / {n2} hits");
        assert!((v1 - v2).abs() < 0.15, "{kind:?}: {v1} / {v2}");
    }
}

#[test]
fn a_higher_rate_is_analysed_like_48_khz() {
    let mut a = Analyzer::new(96_000);
    assert_eq!((a.decimate, a.hop), (2, 256));
    let mut hits = Vec::new();
    let tone: Vec<f32> = (0..96_000)
        .map(|i| (TAU * 45.0 * i as f32 / 96_000.0).sin())
        .collect();
    a.push(&tone, &mut hits);
    assert!(a.levels().sub > 0.9 && (a.time() - 1.0).abs() < 1e-3);
    let b = Analyzer::new(44_100);
    assert_eq!((b.decimate, b.hop), (1, 235));
}
