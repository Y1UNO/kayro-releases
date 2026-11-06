//! MediaPipe Hands in ONNX (OpenCV zoo, 2023-02, Apache-2.0): the palm detector (192×192) finds
//! a hand when none is followed, then the landmark model (224×224) gives 21 points on a crop
//! turned so the hand stands up; the next crop comes from those points (tracking), so the
//! detector only runs again when the hand is lost.

use std::path::Path;

use ort::environment::Environment;
use ort::session::Session;
use ort::value::Tensor;

const PALM: usize = 192;
const MARK: usize = 224;

/// A square crop: image point = c + side · (u·ax + v·ay), u and v in −0.5..0.5.
#[derive(Clone, Copy, Debug)]
pub struct Rect {
    pub c: [f32; 2],
    pub side: f32,
    pub ax: [f32; 2],
    pub ay: [f32; 2],
}

pub struct Hand {
    /// Image pixels (x, y) and depth relative to the wrist.
    pub pts: [[f32; 3]; 21],
    /// Metres, centred on the hand.
    pub world: [[f32; 3]; 21],
}

pub struct Hands {
    palm: Session,
    mark: Session,
    anchors: Vec<[f32; 2]>,
}

/// The SSD anchors of the 192 palm detector: 24×24 cells × 2, then 12×12 cells × 6.
fn anchors() -> Vec<[f32; 2]> {
    let mut a = Vec::with_capacity(2016);
    for (n, per) in [(24usize, 2usize), (12, 6)] {
        for y in 0..n {
            for x in 0..n {
                for _ in 0..per {
                    a.push([(x as f32 + 0.5) / n as f32, (y as f32 + 0.5) / n as f32]);
                }
            }
        }
    }
    a
}

/// Bilinear RGB (0–1) at (x, y) in a BGRA image; black outside.
#[inline]
fn sample(img: &[u8], w: usize, h: usize, x: f32, y: f32) -> [f32; 3] {
    let x0 = x.floor();
    let y0 = y.floor();
    let (fx, fy) = (x - x0, y - y0);
    let mut acc = [0f32; 3];
    for (dy, wy) in [(0i32, 1.0 - fy), (1, fy)] {
        for (dx, wx) in [(0i32, 1.0 - fx), (1, fx)] {
            let (px, py) = (x0 as i32 + dx, y0 as i32 + dy);
            if px < 0 || py < 0 || px >= w as i32 || py >= h as i32 {
                continue;
            }
            let i = (py as usize * w + px as usize) * 4;
            let k = wx * wy / 255.0;
            acc[0] += img[i + 2] as f32 * k;
            acc[1] += img[i + 1] as f32 * k;
            acc[2] += img[i] as f32 * k;
        }
    }
    acc
}

fn axes(from: [f32; 2], to: [f32; 2]) -> ([f32; 2], [f32; 2]) {
    let (dx, dy) = (to[0] - from[0], to[1] - from[1]);
    let n = (dx * dx + dy * dy).sqrt().max(1e-6);
    let d = [dx / n, dy / n];
    // The crop's "up" (0, −1) maps onto d, the wrist → middle finger direction.
    ([-d[1], d[0]], [-d[0], -d[1]])
}

/// The square crop around `pts` turned along wrist → `tip`, shifted and enlarged (MediaPipe).
fn rect_around(pts: &[[f32; 2]], wrist: [f32; 2], tip: [f32; 2], shift_y: f32, scale: f32) -> Rect {
    let (ax, ay) = axes(wrist, tip);
    let dot = |p: [f32; 2], a: [f32; 2]| p[0] * a[0] + p[1] * a[1];
    let (mut u0, mut u1, mut v0, mut v1) = (f32::MAX, f32::MIN, f32::MAX, f32::MIN);
    for p in pts {
        let (u, v) = (dot(*p, ax), dot(*p, ay));
        u0 = u0.min(u);
        u1 = u1.max(u);
        v0 = v0.min(v);
        v1 = v1.max(v);
    }
    let (cu, cv) = ((u0 + u1) / 2.0, (v0 + v1) / 2.0 + shift_y * (v1 - v0));
    let c = [cu * ax[0] + cv * ay[0], cu * ax[1] + cv * ay[1]];
    Rect {
        c,
        side: (u1 - u0).max(v1 - v0) * scale,
        ax,
        ay,
    }
}

impl Hands {
    pub fn load(env: &Environment, dir: &Path, threads: usize) -> ort::Result<Self> {
        let open = |name: &str| -> ort::Result<Session> {
            let s = Session::builder(env)?
                .with_intra_threads(threads)?
                .with_inter_threads(1)?
                .commit_from_file(dir.join(name))?;
            Ok(s)
        };
        Ok(Self {
            palm: open(super::models::PALM)?,
            mark: open(super::models::MARK)?,
            anchors: anchors(),
        })
    }

    /// The best palm (score ≥ `min`) turned into the crop for the landmark model.
    pub fn detect(
        &mut self,
        img: &[u8],
        w: usize,
        h: usize,
        min: f32,
    ) -> ort::Result<Option<(Rect, f32)>> {
        let s = PALM as f32 / w.max(h) as f32;
        let (px, py) = (
            (PALM as f32 - w as f32 * s) / 2.0,
            (PALM as f32 - h as f32 * s) / 2.0,
        );
        let mut input = vec![0f32; PALM * PALM * 3];
        for v in 0..PALM {
            for u in 0..PALM {
                let x = (u as f32 + 0.5 - px) / s - 0.5;
                let y = (v as f32 + 0.5 - py) / s - 0.5;
                let rgb = sample(img, w, h, x, y);
                input[(v * PALM + u) * 3..][..3].copy_from_slice(&rgb);
            }
        }
        let out = self.palm.run(ort::inputs![Tensor::from_array((
            [1usize, PALM, PALM, 3],
            input
        ))?])?;
        let (mut reg, mut score): (Vec<f32>, Vec<f32>) = (vec![], vec![]);
        for i in 0..out.len() {
            let (shape, data) = out[i].try_extract_tensor::<f32>()?;
            if shape.last() == Some(&18) {
                reg = data.to_vec();
            } else {
                score = data.to_vec();
            }
        }
        let Some((best, &raw)) = score.iter().enumerate().max_by(|a, b| a.1.total_cmp(b.1)) else {
            return Ok(None);
        };
        let p = 1.0 / (1.0 + (-raw).exp());
        if p < min {
            return Ok(None);
        }
        let r = &reg[best * 18..][..18];
        let a = self.anchors[best];
        // Detector space (0–1 of 192) → image pixels.
        let to_img = |nx: f32, ny: f32| [(nx * PALM as f32 - px) / s, (ny * PALM as f32 - py) / s];
        let c = to_img(r[0] / PALM as f32 + a[0], r[1] / PALM as f32 + a[1]);
        let (bw, bh) = (r[2] / s, r[3] / s);
        let k = |i: usize| {
            to_img(
                r[4 + 2 * i] / PALM as f32 + a[0],
                r[5 + 2 * i] / PALM as f32 + a[1],
            )
        };
        let (wrist, middle) = (k(0), k(2));
        // MediaPipe: turned along wrist → middle finger, shifted half a box up, square ×2.6.
        let (ax, ay) = axes(wrist, middle);
        let rect = Rect {
            c: [c[0] - 0.5 * bh * ay[0], c[1] - 0.5 * bh * ay[1]],
            side: bw.max(bh) * 2.6,
            ax,
            ay,
        };
        Ok(Some((rect, p)))
    }

    /// The 21 points in `rect`, or None under `min` confidence.
    pub fn landmarks(
        &mut self,
        img: &[u8],
        w: usize,
        h: usize,
        rect: &Rect,
        min: f32,
    ) -> ort::Result<Option<Hand>> {
        let mut input = vec![0f32; MARK * MARK * 3];
        for v in 0..MARK {
            for u in 0..MARK {
                let (fu, fv) = (
                    (u as f32 + 0.5) / MARK as f32 - 0.5,
                    (v as f32 + 0.5) / MARK as f32 - 0.5,
                );
                let x = rect.c[0] + rect.side * (fu * rect.ax[0] + fv * rect.ay[0]) - 0.5;
                let y = rect.c[1] + rect.side * (fu * rect.ax[1] + fv * rect.ay[1]) - 0.5;
                input[(v * MARK + u) * 3..][..3].copy_from_slice(&sample(img, w, h, x, y));
            }
        }
        let out = self.mark.run(ort::inputs![Tensor::from_array((
            [1usize, MARK, MARK, 3],
            input
        ))?])?;
        let lm = out[0].try_extract_tensor::<f32>()?.1.to_vec();
        let conf = out[1].try_extract_tensor::<f32>()?.1[0];
        let world = out[3].try_extract_tensor::<f32>()?.1.to_vec();
        if conf < min || lm.len() < 63 || world.len() < 63 {
            return Ok(None);
        }
        let mut hand = Hand {
            pts: [[0.0; 3]; 21],
            world: [[0.0; 3]; 21],
        };
        for i in 0..21 {
            let (fu, fv) = (
                lm[i * 3] / MARK as f32 - 0.5,
                lm[i * 3 + 1] / MARK as f32 - 0.5,
            );
            hand.pts[i] = [
                rect.c[0] + rect.side * (fu * rect.ax[0] + fv * rect.ay[0]),
                rect.c[1] + rect.side * (fu * rect.ax[1] + fv * rect.ay[1]),
                lm[i * 3 + 2] * rect.side / MARK as f32,
            ];
            hand.world[i] = [world[i * 3], world[i * 3 + 1], world[i * 3 + 2]];
        }
        Ok(Some(hand))
    }
}

/// The next frame's crop from this frame's points (wrist → middle finger base, ×2, up 0.1).
pub fn follow(hand: &Hand) -> Rect {
    let pts: Vec<[f32; 2]> = hand.pts.iter().map(|p| [p[0], p[1]]).collect();
    rect_around(&pts, pts[0], pts[9], -0.1, 2.0)
}

pub fn dist(a: [f32; 3], b: [f32; 3]) -> f32 {
    ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt()
}
