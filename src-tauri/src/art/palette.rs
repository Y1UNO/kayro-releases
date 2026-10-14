//! Colours of an image (step 14), off the interface thread: decode, shrink to 64 × 64, group the
//! pixels in OKLab (a perceptual space) with a deterministic k-means, and name four roles. The
//! output is **raw**: how the colours tint Kayro (mix with the theme, bounds, contrast) is decided
//! by the page, because it depends on the settings and the theme.

use image::{DynamicImage, ImageReader, Limits};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Side of the shrunk image: 4 096 pixels at most, plenty for a few dominant colours.
const SIDE: u32 = 64;
/// Groups looked for.
const K: usize = 6;
const ROUNDS: usize = 12;
/// Pixels more transparent than this are left out (a logo's background is not a colour of it).
const MIN_ALPHA: u8 = 128;
/// Largest image decoded (Steam's heroes are 1920 × 620; a user image can be larger).
const MAX_SIDE: u32 = 8192;

/// One colour in OKLab, with its share of the image.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PaletteColor {
    pub l: f32,
    pub a: f32,
    pub b: f32,
    /// Share of the visible pixels, 0 to 1.
    pub weight: f32,
    /// The same colour in sRGB (`#rrggbb`), for display and checks.
    pub hex: String,
}

/// The colours of an image, largest share first, and the index of each role in `colors`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Palette {
    pub colors: Vec<PaletteColor>,
    /// Largest share among colours that are neither almost black nor almost white.
    pub dominant: u8,
    /// Most vivid colour clearly apart from the dominant one (the dominant one if none).
    pub accent: u8,
    pub dark: u8,
    pub light: u8,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PaletteError {
    #[error("not a readable image: {0}")]
    Decode(String),
    #[error("no visible pixel")]
    Empty,
}

pub type Lab = [f32; 3];

fn srgb_to_linear(c: u8) -> f32 {
    let c = f32::from(c) / 255.0;
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn linear_to_srgb(c: f32) -> u8 {
    let c = c.clamp(0.0, 1.0);
    let s = if c <= 0.003_130_8 {
        12.92 * c
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    };
    (s * 255.0).round() as u8
}

/// sRGB → OKLab (Björn Ottosson, 2020).
pub fn to_oklab(rgb: [u8; 3]) -> Lab {
    let [r, g, b] = rgb.map(srgb_to_linear);
    let l = (0.412_221_47 * r + 0.536_332_55 * g + 0.051_445_995 * b).cbrt();
    let m = (0.211_903_5 * r + 0.680_699_5 * g + 0.107_396_96 * b).cbrt();
    let s = (0.088_302_46 * r + 0.281_718_85 * g + 0.629_978_7 * b).cbrt();
    [
        0.210_454_26 * l + 0.793_617_8 * m - 0.004_072_047 * s,
        1.977_998_5 * l - 2.428_592_2 * m + 0.450_593_7 * s,
        0.025_904_037 * l + 0.782_771_77 * m - 0.808_675_77 * s,
    ]
}

/// OKLab → sRGB, clamped to the sRGB gamut.
pub fn to_srgb([l, a, b]: Lab) -> [u8; 3] {
    let l_ = (l + 0.396_337_78 * a + 0.215_803_76 * b).powi(3);
    let m_ = (l - 0.105_561_346 * a - 0.063_854_17 * b).powi(3);
    let s_ = (l - 0.089_484_18 * a - 1.291_485_5 * b).powi(3);
    [
        4.076_741_7 * l_ - 3.307_711_6 * m_ + 0.230_969_94 * s_,
        -1.268_438 * l_ + 2.609_757_4 * m_ - 0.341_319_38 * s_,
        -0.004_196_086_3 * l_ - 0.703_418_6 * m_ + 1.707_614_7 * s_,
    ]
    .map(linear_to_srgb)
}

pub fn chroma(c: &Lab) -> f32 {
    c[1].hypot(c[2])
}

fn distance2(p: &Lab, q: &Lab) -> f32 {
    (p[0] - q[0]).powi(2) + (p[1] - q[1]).powi(2) + (p[2] - q[2]).powi(2)
}

/// Decodes `bytes` (JPEG, PNG or WebP) and shrinks it to at most 64 × 64.
pub fn decode(bytes: &[u8]) -> Result<DynamicImage, PaletteError> {
    let mut reader = ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| PaletteError::Decode(e.to_string()))?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_SIDE);
    limits.max_image_height = Some(MAX_SIDE);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|e| PaletteError::Decode(e.to_string()))?;
    Ok(image.thumbnail(SIDE, SIDE))
}

/// Visible pixels of a (small) image, in OKLab.
pub fn pixels(image: &DynamicImage) -> Vec<Lab> {
    image
        .to_rgba8()
        .pixels()
        .filter(|p| p.0[3] >= MIN_ALPHA)
        .map(|p| to_oklab([p.0[0], p.0[1], p.0[2]]))
        .collect()
}

/// Deterministic k-means: the first centre is the mean, each next one the pixel farthest from the
/// centres already chosen (so a small vivid area still gets its own group). Same input, same output.
pub fn kmeans(points: &[Lab], k: usize) -> Vec<(Lab, usize)> {
    if points.is_empty() || k == 0 {
        return Vec::new();
    }
    let n = points.len() as f32;
    let mean = points.iter().fold([0.0; 3], |acc, p| {
        [acc[0] + p[0] / n, acc[1] + p[1] / n, acc[2] + p[2] / n]
    });
    let mut centres = vec![mean];
    let mut nearest: Vec<f32> = points.iter().map(|p| distance2(p, &mean)).collect();
    while centres.len() < k {
        let (far, d) =
            nearest.iter().enumerate().fold(
                (0, -1.0_f32),
                |best, (i, &d)| if d > best.1 { (i, d) } else { best },
            );
        if d <= 1e-6 {
            break; // every pixel already sits on a centre
        }
        let c = points[far];
        for (slot, p) in nearest.iter_mut().zip(points) {
            *slot = slot.min(distance2(p, &c));
        }
        centres.push(c);
    }
    let mut owner = vec![0usize; points.len()];
    for _ in 0..ROUNDS {
        let mut moved = false;
        for (o, p) in owner.iter_mut().zip(points) {
            let best = (0..centres.len())
                .min_by(|&i, &j| distance2(p, &centres[i]).total_cmp(&distance2(p, &centres[j])))
                .unwrap_or(0);
            moved |= best != *o;
            *o = best;
        }
        let mut sums = vec![([0.0_f32; 3], 0usize); centres.len()];
        for (o, p) in owner.iter().zip(points) {
            let s = &mut sums[*o];
            s.0 = [s.0[0] + p[0], s.0[1] + p[1], s.0[2] + p[2]];
            s.1 += 1;
        }
        for (c, (sum, count)) in centres.iter_mut().zip(&sums) {
            if *count > 0 {
                let m = *count as f32;
                *c = [sum[0] / m, sum[1] / m, sum[2] / m];
            }
        }
        if !moved {
            break;
        }
    }
    let mut counts = vec![0usize; centres.len()];
    for o in &owner {
        counts[*o] += 1;
    }
    let mut groups: Vec<(Lab, usize)> = centres
        .into_iter()
        .zip(counts)
        .filter(|(_, count)| *count > 0)
        .collect();
    groups.sort_by_key(|g| std::cmp::Reverse(g.1));
    groups
}

/// Hue difference in degrees (0 to 180).
fn hue_gap(p: &Lab, q: &Lab) -> f32 {
    let d = (p[2].atan2(p[1]) - q[2].atan2(q[1])).to_degrees().abs() % 360.0;
    d.min(360.0 - d)
}

/// Names the roles among `colors` (largest share first, never empty).
fn roles(colors: &[(Lab, f32)]) -> (u8, u8, u8, u8) {
    let index = |i: usize| u8::try_from(i).unwrap_or(0);
    let mid = |c: &Lab| (0.2..=0.94).contains(&c[0]);
    let dominant = colors.iter().position(|(c, _)| mid(c)).unwrap_or(0);
    let d = colors[dominant].0;
    let vivid = |(i, (c, w)): (usize, &(Lab, f32))| (i, w.sqrt() * chroma(c));
    let apart = colors
        .iter()
        .enumerate()
        .filter(|(i, (c, _))| *i != dominant && (chroma(&d) < 0.03 || hue_gap(c, &d) >= 25.0))
        .map(vivid)
        .max_by(|x, y| x.1.total_cmp(&y.1));
    let accent = apart
        .filter(|(_, score)| *score > 0.0)
        .map_or(dominant, |(i, _)| i);
    let by_l = |cmp: fn(f32, f32) -> bool| {
        (0..colors.len())
            .reduce(|best, i| {
                if cmp(colors[i].0[0], colors[best].0[0]) {
                    i
                } else {
                    best
                }
            })
            .unwrap_or(0)
    };
    (
        index(dominant),
        index(accent),
        index(by_l(|a, b| a < b)),
        index(by_l(|a, b| a > b)),
    )
}

/// Palette of an image's bytes (JPEG, PNG or WebP).
pub fn extract(bytes: &[u8]) -> Result<Palette, PaletteError> {
    let points = pixels(&decode(bytes)?);
    let groups = kmeans(&points, K);
    if groups.is_empty() {
        return Err(PaletteError::Empty);
    }
    let total = points.len() as f32;
    let weighted: Vec<(Lab, f32)> = groups
        .into_iter()
        .map(|(c, n)| (c, n as f32 / total))
        .collect();
    let (dominant, accent, dark, light) = roles(&weighted);
    let colors = weighted
        .iter()
        .map(|(c, w)| {
            let [r, g, b] = to_srgb(*c);
            PaletteColor {
                l: c[0],
                a: c[1],
                b: c[2],
                weight: *w,
                hex: format!("#{r:02x}{g:02x}{b:02x}"),
            }
        })
        .collect();
    Ok(Palette {
        colors,
        dominant,
        accent,
        dark,
        light,
    })
}

#[cfg(test)]
#[path = "palette_tests.rs"]
mod tests;
