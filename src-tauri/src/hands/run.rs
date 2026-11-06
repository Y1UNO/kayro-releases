//! The hands' thread: parked (no camera) while the hands are off, paused or not installed; on,
//! it opens the webcam, follows the hand frame after frame and drives the cursor, until they are
//! turned off (the shortcut, a thumb up held a second), a game comes in front, or no hand has
//! shown for `idle_minutes`.

use std::time::{Duration, Instant};

use tauri::{AppHandle, Runtime};

use super::glide::Glide;
use super::pointer::{Act, Button, Pointer, Seen};
use super::track::{self, dist, Hand, Rect};
use super::{cam, glow, models, now, set_status, wait_change, wait_change_for, HandsStatus, Now};
use crate::config::hands::RightFinger;
use crate::platform::mouse;

/// Looking for a hand (the heavier model) at most this often while none is seen.
const SEARCH_EVERY: Duration = Duration::from_millis(200);
/// The models' confidence under which there is no new hand…
const MIN_SCORE: f32 = 0.5;
/// …and under which a hand followed is lost (a pinch, a quick move lower it for a frame).
const KEEP_SCORE: f32 = 0.35;
/// A hand lost for less than this changes nothing: no button let go, no move (the user's test of
/// 2026-11-05: the hand was lost for a frame every 0.3–1 s, and each loss dropped a drag).
const GRACE: Duration = Duration::from_millis(300);
/// How much of the last frame's move the next crop takes ahead (quick moves stay in it).
const LEAD: f32 = 0.8;
/// The webcam's width asked for (the closest format is taken).
const CAMERA_WIDTH: u32 = 640;
/// A webcam held by another app is tried again this often.
const BUSY_RETRY: Duration = Duration::from_secs(3);

pub fn run<R: Runtime>(app: &AppHandle<R>) {
    let mut tracker: Option<track::Hands> = None;
    // Tries in a row that found the webcam busy (said once in the log).
    let mut busy = 0u32;
    loop {
        let n = now();
        if !n.on {
            busy = 0;
            glow::hide();
            // The models' memory goes back to the PC while the hands are off.
            tracker = None;
            set_status(app, HandsStatus::Off);
            wait_change(n.gen);
            continue;
        }
        if n.paused {
            glow::hide();
            set_status(app, HandsStatus::Paused);
            wait_change(n.gen);
            continue;
        }
        if !models::installed() {
            set_status(app, HandsStatus::Missing);
            wait_change(n.gen);
            continue;
        }
        if busy == 0 {
            // (Not between two tries at a busy webcam: the island would say it each time.)
            set_status(app, HandsStatus::Starting);
        }
        if tracker.is_none() {
            tracker = load(app);
        }
        let Some(hands) = tracker.as_mut() else {
            set_status(app, HandsStatus::Missing);
            wait_change(n.gen);
            continue;
        };
        let camera = match cam::Cam::open(CAMERA_WIDTH) {
            Ok(c) => c,
            Err(e) => {
                if busy == 0 {
                    tracing::warn!(error = %e, "hands: no webcam");
                }
                busy += 1;
                set_status(app, HandsStatus::NoCamera);
                wait_change_for(n.gen, BUSY_RETRY);
                continue;
            }
        };
        if busy == 0 {
            tracing::info!(
                camera = %camera.name, width = camera.w, height = camera.h, format = %camera.sub, fps = camera.fps,
                "hands: the camera is open"
            );
        }
        let frames = follow(app, &camera, hands, &n);
        drop(camera);
        glow::hide();
        if frames == 0 && !super::changed(n.gen) {
            // Another app holds the webcam (OBS, a call…: the user's test of 2026-11-05, 210 tries
            // in 27 s). Said once, then tried again every few seconds, quietly.
            if busy == 0 {
                tracing::info!("hands: the webcam gives no image (another app has it?)");
            }
            busy += 1;
            set_status(app, HandsStatus::NoCamera);
            wait_change_for(n.gen, BUSY_RETRY);
            continue;
        }
        if busy > 0 {
            tracing::info!(tries = busy, "hands: the webcam is free again");
            busy = 0;
        }
        tracing::info!("hands: the camera is closed");
    }
}

fn load<R: Runtime>(app: &AppHandle<R>) -> Option<track::Hands> {
    let env = crate::media::rhythm::environment(&crate::media::models_dir(app))?;
    match track::Hands::load(env, &models::dir(), 1) {
        Ok(h) => Some(h),
        Err(e) => {
            tracing::warn!(error = %e, "hands: the models did not load");
            None
        }
    }
}

/// What the pointer needs of the 21 points (the image is mirrored: the user's right is right).
fn seen(hand: &Hand, w: usize, right: RightFinger) -> Seen {
    let (p, wp) = (&hand.pts, &hand.world);
    // The palm's centre (wrist and the four fingers' bases): it moves less than a finger.
    let palm = [0, 5, 9, 13, 17];
    let cx = palm.iter().map(|&i| p[i][0]).sum::<f32>() / 5.0;
    let cy = palm.iter().map(|&i| p[i][1]).sum::<f32>() / 5.0;
    let w = w as f32;
    // A finger stretched: its tip further from the wrist than its base by a fifth.
    let stretched = |tip: usize, base: usize| dist(wp[tip], wp[0]) > 1.2 * dist(wp[base], wp[0]);
    let folded = [(8, 5), (12, 9), (16, 13), (20, 17)]
        .iter()
        .all(|&(t, b)| !stretched(t, b));
    // The thumb's tip well above the index's base on the image, and away from it.
    let palm_size = ((p[0][0] - p[5][0]).powi(2) + (p[0][1] - p[5][1]).powi(2)).sqrt();
    let thumb_up = folded
        && p[4][1] < p[5][1] - 0.6 * palm_size
        && dist(wp[4], wp[5]) > 0.5 * dist(wp[0], wp[5]);
    Seen {
        anchor: [(w - cx) / w, cy / w],
        index_cm: dist(wp[4], wp[8]) * 100.0,
        right_cm: dist(
            wp[4],
            wp[if right == RightFinger::Middle { 12 } else { 16 }],
        ) * 100.0,
        pointing: stretched(8, 5),
        index_reach: dist(wp[8], wp[5]) / dist(wp[0], wp[5]).max(1e-4),
        thumb_up,
    }
}

/// Finds the hand in each frame: in the crop the last frame gave (taken ahead by the move), or,
/// when lost, with the palm detector at once in the same frame (5 times a second at most when no
/// hand has been seen for a while).
#[derive(Default)]
struct Finder {
    rect: Option<Rect>,
    centre: Option<[f32; 2]>,
    searched: Option<Instant>,
    losses: u32,
    searches: u32,
}

impl Finder {
    fn find(
        &mut self,
        hands: &mut track::Hands,
        img: &[u8],
        (w, h): (usize, usize),
        recently: bool,
    ) -> Option<Hand> {
        let mut hand = self
            .rect
            .and_then(|r| hands.landmarks(img, w, h, &r, KEEP_SCORE).ok().flatten());
        if hand.is_none() && self.rect.is_some() {
            self.losses += 1;
        }
        let may_search = recently || self.searched.is_none_or(|t| t.elapsed() >= SEARCH_EVERY);
        if hand.is_none() && may_search {
            self.searched = Some(Instant::now());
            self.searches += 1;
            if let Some((r, _)) = hands.detect(img, w, h, MIN_SCORE).ok().flatten() {
                hand = hands.landmarks(img, w, h, &r, MIN_SCORE).ok().flatten();
                self.centre = None;
            }
        }
        self.rect = hand.as_ref().map(|hd| {
            let mut r = track::follow(hd);
            let c = r.c;
            if let Some(b) = self.centre {
                r.c = [c[0] + (c[0] - b[0]) * LEAD, c[1] + (c[1] - b[1]) * LEAD];
            }
            self.centre = Some(c);
            r
        });
        if hand.is_none() {
            self.centre = None;
        }
        hand
    }
}

/// Follows the hand until the hands turn off or the webcam stops; how many images came.
fn follow<R: Runtime>(
    app: &AppHandle<R>,
    camera: &cam::Cam,
    hands: &mut track::Hands,
    n: &Now,
) -> u32 {
    let (w, h) = (camera.w as usize, camera.h as usize);
    let idle = Duration::from_secs(60 * u64::from(n.hands.idle_minutes.max(1)));
    let glide = Glide::start(app, n.hands.glow);
    // The screen the hand drives: the one under the cursor when the hand shows.
    let mut screen = mouse::screen_under_cursor().unwrap_or(mouse::desktop());
    let aspect = |s: &mouse::Screen| s.h as f32 / s.w.max(1) as f32;
    let mut pointer = Pointer::new(n.hands.reach, aspect(&screen));
    let mut finder = Finder::default();
    let mut img = Vec::new();
    let mut acts = Vec::new();
    let start = Instant::now();
    let mut last_hand = Instant::now() - GRACE;
    let (mut frames, mut seen_frames, mut clicks) = (0u32, 0u32, 0u32);
    let mut off = false;
    while !super::changed(n.gen) && !off {
        match camera.read(&mut img) {
            Ok(true) => {}
            Ok(false) => continue,
            Err(e) => {
                // At once: another app has the webcam (run() says it, once).
                if frames > 0 {
                    tracing::warn!(error = %e, "hands: the webcam stopped");
                }
                break;
            }
        }
        if frames == 0 {
            set_status(app, HandsStatus::Watching);
        }
        frames += 1;
        let recently = last_hand.elapsed() < GRACE;
        let hand = finder.find(hands, &img, (w, h), recently);
        let now_seen = hand.as_ref().map(|hd| seen(hd, w, n.hands.right_finger));
        match &now_seen {
            Some(_) => {
                if !recently {
                    if let Some(s) = mouse::screen_under_cursor() {
                        screen = s;
                        pointer.set_aspect(aspect(&s));
                    }
                }
                last_hand = Instant::now();
                seen_frames += 1;
            }
            // Lost a moment: wait for it, nothing let go.
            None if recently => continue,
            None => {}
        }
        acts.clear();
        pointer.step(now_seen.as_ref(), start.elapsed().as_secs_f64(), &mut acts);
        for act in &acts {
            match *act {
                Act::MoveTo([x, y]) => glide.aim([
                    f64::from(screen.x) + f64::from(x) * f64::from(screen.w - 1),
                    f64::from(screen.y) + f64::from(y) * f64::from(screen.h - 1),
                ]),
                Act::Down(b) | Act::Up(b) => {
                    let down = matches!(act, Act::Down(_));
                    glide.snap();
                    mouse::button(b == Button::Left, down);
                    clicks += u32::from(down);
                    // How far apart the fingers were (cm), to tune the thresholds; nothing seen.
                    tracing::info!(
                        button = ?b,
                        down,
                        index_cm = now_seen.map_or(-1.0, |s| s.index_cm),
                        right_cm = now_seen.map_or(-1.0, |s| s.right_cm),
                        index_reach = now_seen.map_or(-1.0, |s| s.index_reach),
                        "hands: button"
                    );
                }
                Act::Cross([dx, dy]) => {
                    // The screen beyond this one's edge, level with the cursor.
                    let (cx, cy) = mouse::cursor().unwrap_or((screen.x, screen.y));
                    let x = match dx {
                        -1 => screen.x - 2,
                        1 => screen.x + screen.w + 1,
                        _ => cx.clamp(screen.x, screen.x + screen.w - 1),
                    };
                    let y = match dy {
                        -1 => screen.y - 2,
                        1 => screen.y + screen.h + 1,
                        _ => cy.clamp(screen.y, screen.y + screen.h - 1),
                    };
                    if let Some(s) = mouse::screen_at(x, y) {
                        tracing::info!(dx, dy, "hands: to the next screen");
                        screen = s;
                        pointer.set_aspect(aspect(&s));
                    }
                }
                Act::Off => off = true,
            }
        }
        if now_seen.is_some() {
            glide.lead(pointer.grip());
            set_status(app, HandsStatus::Leading);
        } else {
            glide.leave();
            set_status(app, HandsStatus::Watching);
        }
        if last_hand.elapsed() > idle {
            tracing::info!("hands: no hand for a while, the camera turns off");
            off = true;
        }
    }
    if frames == 0 {
        return 0;
    }
    acts.clear();
    pointer.release(&mut acts);
    for act in &acts {
        if let Act::Up(b) = act {
            mouse::button(*b == Button::Left, false);
        }
    }
    drop(glide);
    let secs = start.elapsed().as_secs_f32().max(0.1);
    tracing::info!(
        seconds = secs as u32,
        fps = frames as f32 / secs,
        seen_percent = (seen_frames as f32 * 100.0 / frames.max(1) as f32) as u32,
        losses = finder.losses,
        searches = finder.searches,
        clicks,
        refused = pointer.refused,
        refused_reach = pointer.refused_reach,
        "hands: session"
    );
    if off {
        super::turn_off(app, n.gen);
    }
    frames
}
