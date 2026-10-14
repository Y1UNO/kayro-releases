use std::io::Cursor;

use image::{ImageFormat, Rgba, RgbaImage};

use super::*;

/// An image made of horizontal bands: `(colour, rows)` from the top.
fn bands(width: u32, parts: &[([u8; 4], u32)]) -> RgbaImage {
    let height = parts.iter().map(|p| p.1).sum();
    let mut img = RgbaImage::new(width, height);
    let mut y0 = 0;
    for (colour, rows) in parts {
        for y in y0..y0 + rows {
            for x in 0..width {
                img.put_pixel(x, y, Rgba(*colour));
            }
        }
        y0 += rows;
    }
    img
}

fn encoded(img: &RgbaImage, format: ImageFormat) -> Vec<u8> {
    let mut out = Cursor::new(Vec::new());
    let image = DynamicImage::ImageRgba8(img.clone());
    let image = if format == ImageFormat::Jpeg {
        DynamicImage::ImageRgb8(image.to_rgb8())
    } else {
        image
    };
    image.write_to(&mut out, format).unwrap();
    out.into_inner()
}

const RED: [u8; 4] = [200, 40, 40, 255];
const BLUE: [u8; 4] = [40, 70, 210, 255];
const BLACK: [u8; 4] = [6, 6, 8, 255];

#[test]
fn oklab_round_trips_and_matches_known_values() {
    for rgb in [
        [0, 0, 0],
        [255, 255, 255],
        [200, 40, 40],
        [12, 200, 90],
        [128, 128, 128],
    ] {
        assert_eq!(to_srgb(to_oklab(rgb)), rgb, "{rgb:?}");
    }
    let white = to_oklab([255, 255, 255]);
    assert!((white[0] - 1.0).abs() < 1e-3 && chroma(&white) < 1e-3);
    // Pure red: L ≈ 0.628, a ≈ 0.225, b ≈ 0.126 (Ottosson's reference values).
    let red = to_oklab([255, 0, 0]);
    assert!((red[0] - 0.628).abs() < 2e-3 && (red[1] - 0.225).abs() < 2e-3);
}

#[test]
fn the_largest_colour_is_dominant_and_the_other_hue_the_accent() {
    let img = bands(90, &[(RED, 70), (BLUE, 30)]);
    let p = extract(&encoded(&img, ImageFormat::Png)).unwrap();
    let dominant = &p.colors[p.dominant as usize];
    let accent = &p.colors[p.accent as usize];
    assert_eq!(dominant.hex, "#c82828");
    assert_eq!(accent.hex, "#2846d2");
    assert!((dominant.weight - 0.7).abs() < 0.03, "{}", dominant.weight);
    let total: f32 = p.colors.iter().map(|c| c.weight).sum();
    assert!((total - 1.0).abs() < 1e-3);
}

#[test]
fn a_black_frame_is_never_the_dominant_colour_but_is_the_dark_one() {
    // Many posters are mostly a dark frame around a coloured subject.
    let img = bands(80, &[(BLACK, 60), (BLUE, 25), (RED, 15)]);
    let p = extract(&encoded(&img, ImageFormat::Png)).unwrap();
    assert_eq!(p.colors[0].hex, "#060608", "largest share first");
    assert_eq!(p.colors[p.dominant as usize].hex, "#2846d2");
    assert_eq!(p.colors[p.dark as usize].hex, "#060608");
    assert_eq!(p.colors[p.accent as usize].hex, "#c82828");
}

#[test]
fn jpeg_posters_are_read_too() {
    let img = bands(64, &[(RED, 50), (BLUE, 50)]);
    let p = extract(&encoded(&img, ImageFormat::Jpeg)).unwrap();
    assert!(p.colors.len() >= 2);
    // JPEG blurs the edge between the bands: the colours stay close to the source.
    let red = to_oklab([200, 40, 40]);
    let c = &p.colors[p.dominant as usize];
    let d = ((c.l - red[0]).powi(2) + (c.a - red[1]).powi(2) + (c.b - red[2]).powi(2)).sqrt();
    let blue = to_oklab([40, 70, 210]);
    let e = ((c.l - blue[0]).powi(2) + (c.a - blue[1]).powi(2) + (c.b - blue[2]).powi(2)).sqrt();
    assert!(d.min(e) < 0.03, "{d} {e}");
}

#[test]
fn transparent_pixels_are_left_out_and_a_grey_image_has_one_colour() {
    let logo = bands(40, &[([0, 0, 0, 0], 30), (RED, 10)]);
    let p = extract(&encoded(&logo, ImageFormat::Png)).unwrap();
    assert_eq!(p.colors.len(), 1);
    assert_eq!((p.dominant, p.accent, p.dark, p.light), (0, 0, 0, 0));
    let grey = bands(16, &[([128, 128, 128, 255], 16)]);
    let p = extract(&encoded(&grey, ImageFormat::Png)).unwrap();
    assert_eq!(p.colors.len(), 1);
    let empty = bands(8, &[([9, 9, 9, 0], 8)]);
    assert_eq!(
        extract(&encoded(&empty, ImageFormat::Png)),
        Err(PaletteError::Empty)
    );
}

#[test]
fn the_same_image_always_gives_the_same_palette() {
    // A noisy image (a gradient with a pattern) so that the k-means has real work to do.
    let mut img = RgbaImage::new(97, 143);
    for (x, y, px) in img.enumerate_pixels_mut() {
        *px = Rgba([(x * 2) as u8, (y + x * y % 7) as u8, (255 - y) as u8, 255]);
    }
    let bytes = encoded(&img, ImageFormat::Png);
    let first = extract(&bytes).unwrap();
    assert_eq!(first.colors.len(), K);
    for _ in 0..3 {
        assert_eq!(extract(&bytes).unwrap(), first);
    }
}

#[test]
fn broken_files_are_refused_without_panicking() {
    assert!(matches!(
        extract(b"not an image"),
        Err(PaletteError::Decode(_))
    ));
    let png = encoded(&bands(8, &[(RED, 8)]), ImageFormat::Png);
    assert!(matches!(
        extract(&png[..png.len() / 2]),
        Err(PaletteError::Decode(_))
    ));
    let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10];
    assert!(matches!(extract(&jpeg), Err(PaletteError::Decode(_))));
}

/// Measure on the real Steam cache of this PC (read-only, nothing written): time per image and for
/// the whole library. `cargo test --release -q measure_real_steam_cache -- --ignored --nocapture`.
#[test]
#[ignore = "reads the real Steam cache (run by hand)"]
fn measure_real_steam_cache() {
    use crate::art::{locate, ArtRole, ArtRoots};
    use std::time::Instant;
    let roots = ArtRoots::system(std::env::temp_dir().join("kayro-no-user-art"));
    let cache = roots.steam_cache.expect("Steam is installed");
    let mut ids: Vec<String> = std::fs::read_dir(&cache)
        .unwrap()
        .flatten()
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    ids.sort();
    for role in [ArtRole::Poster, ArtRole::Hero] {
        let (mut decode_ms, mut total_ms, mut failed) = (Vec::new(), Vec::new(), 0);
        let all = Instant::now();
        for id in &ids {
            let Some(found) = locate::steam(&cache, id, role) else {
                continue;
            };
            let bytes = std::fs::read(&found.path).unwrap();
            let t0 = Instant::now();
            let small = decode(&bytes);
            decode_ms.push(t0.elapsed().as_secs_f64() * 1000.0);
            match small {
                Ok(img) => {
                    let _ = kmeans(&pixels(&img), K);
                }
                Err(_) => failed += 1,
            }
            total_ms.push(t0.elapsed().as_secs_f64() * 1000.0);
        }
        let stats = |v: &mut Vec<f64>| {
            v.sort_by(f64::total_cmp);
            let mean = v.iter().sum::<f64>() / v.len().max(1) as f64;
            let p95 = v.get(v.len() * 95 / 100).copied().unwrap_or(0.0);
            (mean, p95, v.last().copied().unwrap_or(0.0))
        };
        let n = total_ms.len();
        let (dm, dp, dx) = stats(&mut decode_ms);
        let (tm, tp, tx) = stats(&mut total_ms);
        println!(
            "{role:?}: {n} images, {failed} refused, all in {:.0} ms | decode mean {dm:.1} p95 {dp:.1} max {dx:.1} ms | decode + k-means mean {tm:.1} p95 {tp:.1} max {tx:.1} ms",
            all.elapsed().as_secs_f64() * 1000.0
        );
    }
}
