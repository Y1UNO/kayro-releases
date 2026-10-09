//! Program icons shown on the cards: read from the program or shortcut, shrunk, and kept as small
//! PNG files in `cache/icons/` (rebuilt on demand, never exported). The file name carries a hash of
//! the source path, so editing an app's target never serves the old icon.

use std::fs;
use std::path::{Path, PathBuf};

use crate::config::apps::{AppEntry, Launch};
use crate::detect::short_hash;
use crate::platform::icon::Rgba;

/// Side of the stored icon, in pixels (cards show it at 56–96 px).
pub const ICON_PX: u32 = 128;

/// The file the Shell can take an icon from: a program or a shortcut. Links, protocols and
/// packaged apps have none (the card keeps its monogram).
pub fn icon_source(launch: &Launch) -> Option<&str> {
    match launch {
        Launch::Exe { path, .. } | Launch::Lnk { path } => Some(path),
        _ => None,
    }
}

fn file_for(dir: &Path, id: &str, source: &str) -> PathBuf {
    dir.join(format!("{id}-{}.png", short_hash(&source.to_lowercase())))
}

/// Shrinks `icon` to at most `max` pixels on its longest side by averaging (box filter), with
/// colours weighted by their alpha so transparent pixels never tint the result. Never enlarges.
pub fn shrink(icon: &Rgba, max: u32) -> Rgba {
    let longest = icon.width.max(icon.height);
    if longest <= max || icon.width == 0 || icon.height == 0 {
        return icon.clone();
    }
    let w = (icon.width * max / longest).max(1);
    let h = (icon.height * max / longest).max(1);
    let span = |i: u32, out: u32, src: u32| {
        let from = i * src / out;
        (from, ((i + 1) * src / out).max(from + 1).min(src))
    };
    let mut pixels = Vec::with_capacity((w * h * 4) as usize);
    for y in 0..h {
        let (y0, y1) = span(y, h, icon.height);
        for x in 0..w {
            let (x0, x1) = span(x, w, icon.width);
            let (mut r, mut g, mut b, mut a, mut n) = (0u64, 0u64, 0u64, 0u64, 0u64);
            for sy in y0..y1 {
                for sx in x0..x1 {
                    let i = ((sy * icon.width + sx) * 4) as usize;
                    let alpha = u64::from(icon.pixels[i + 3]);
                    r += u64::from(icon.pixels[i]) * alpha;
                    g += u64::from(icon.pixels[i + 1]) * alpha;
                    b += u64::from(icon.pixels[i + 2]) * alpha;
                    a += alpha;
                    n += 1;
                }
            }
            if a == 0 || n == 0 {
                pixels.extend_from_slice(&[0, 0, 0, 0]);
            } else {
                pixels.extend_from_slice(&[
                    (r / a) as u8,
                    (g / a) as u8,
                    (b / a) as u8,
                    (a / n) as u8,
                ]);
            }
        }
    }
    Rgba {
        width: w,
        height: h,
        pixels,
    }
}

pub fn encode_png(icon: &Rgba) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut encoder = png::Encoder::new(&mut out, icon.width, icon.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder
        .write_header()
        .and_then(|mut w| w.write_image_data(&icon.pixels))
        .map_err(|e| e.to_string())?;
    Ok(out)
}

/// `data:image/png;base64,…`: how the interface receives an icon (the CSP allows `data:` images,
/// and no file-protocol scope has to be opened onto the data folder).
pub fn png_data_url(png: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(22 + png.len().div_ceil(3) * 4);
    out.push_str("data:image/png;base64,");
    for chunk in png.chunks(3) {
        let n = chunk
            .iter()
            .enumerate()
            .fold(0u32, |acc, (i, b)| acc | (u32::from(*b) << (16 - 8 * i)));
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(char::from(ALPHABET[((n >> (18 - 6 * i)) & 63) as usize]));
            } else {
                out.push('=');
            }
        }
    }
    out
}

/// PNG bytes of the icon of `app`: from the cache when it is there, else extracted with `extract`
/// (the Shell, or a fake in tests) and stored. `None` when the app has no icon.
pub fn icon_png(
    icons_dir: &Path,
    app: &AppEntry,
    extract: &dyn Fn(&str) -> Option<Rgba>,
) -> Option<Vec<u8>> {
    let source = icon_source(&app.launch)?;
    let file = file_for(icons_dir, &app.id, source);
    if let Ok(bytes) = fs::read(&file) {
        return Some(bytes);
    }
    let icon = shrink(&extract(source)?, ICON_PX);
    let bytes = match encode_png(&icon) {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(app = %app.id, error = %e, "icon: could not encode");
            return None;
        }
    };
    let stored = fs::create_dir_all(icons_dir)
        .and_then(|()| crate::config::atomic::write_atomic(&file, &bytes));
    if let Err(e) = stored {
        // The icon is still served; only the cache is missing.
        tracing::warn!(app = %app.id, error = %e, "icon: could not cache");
    }
    Some(bytes)
}

/// Deletes the cached icons of an app that was removed (best effort).
pub fn forget(icons_dir: &Path, id: &str) {
    let prefix = format!("{id}-");
    let Ok(entries) = fs::read_dir(icons_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        // `<id>-<12 hex>.png`: the id may itself contain dashes, so the tail must be exact.
        let is_ours = name
            .strip_prefix(&prefix)
            .and_then(|rest| rest.strip_suffix(".png"))
            .is_some_and(|hash| hash.len() == 12 && hash.bytes().all(|b| b.is_ascii_hexdigit()));
        if is_ours {
            let _ = fs::remove_file(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::apps::{AppSource, Art, MatchRule};
    use std::cell::Cell;

    fn app(id: &str, path: &str) -> AppEntry {
        AppEntry {
            id: id.into(),
            name: id.into(),
            category: "autres".into(),
            source: AppSource::Manual,
            launch: Launch::Exe {
                path: path.into(),
                args: vec![],
                cwd: None,
                elevated: false,
            },
            match_rule: MatchRule::default(),
            art: Art::default(),
            mood_id: None,
            favorite: false,
        }
    }

    fn square(side: u32, rgba: [u8; 4]) -> Rgba {
        Rgba {
            width: side,
            height: side,
            pixels: rgba.repeat((side * side) as usize),
        }
    }

    #[test]
    fn shrinking_keeps_colour_and_never_enlarges() {
        let big = shrink(&square(256, [200, 100, 50, 255]), ICON_PX);
        assert_eq!((big.width, big.height), (128, 128));
        assert_eq!(&big.pixels[..4], &[200, 100, 50, 255]);
        let small = square(48, [1, 2, 3, 255]);
        assert_eq!(shrink(&small, ICON_PX), small);
    }

    #[test]
    fn transparent_pixels_do_not_bleed_into_colours() {
        // Left half opaque red, right half fully transparent: the average of the whole image
        // must stay red, only half as opaque.
        let mut icon = square(4, [0, 0, 0, 0]);
        for y in 0..4 {
            for x in 0..2 {
                let i = (y * 4 + x) * 4;
                icon.pixels[i..i + 4].copy_from_slice(&[255, 0, 0, 255]);
            }
        }
        let out = shrink(&icon, 1);
        assert_eq!(out.pixels, vec![255, 0, 0, 127]);
    }

    #[test]
    fn base64_matches_the_reference_vectors() {
        let b64 = |t: &[u8]| png_data_url(t)["data:image/png;base64,".len()..].to_string();
        assert_eq!(b64(b""), "");
        assert_eq!(b64(b"f"), "Zg==");
        assert_eq!(b64(b"fo"), "Zm8=");
        assert_eq!(b64(b"foo"), "Zm9v");
        assert_eq!(b64(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn png_has_the_png_signature() {
        let bytes = encode_png(&square(8, [9, 8, 7, 255])).unwrap();
        assert_eq!(&bytes[1..4], b"PNG");
    }

    #[test]
    fn extracted_once_then_served_from_the_cache() {
        let dir = tempfile::tempdir().unwrap();
        let calls = Cell::new(0);
        let extract = |_: &str| {
            calls.set(calls.get() + 1);
            Some(square(64, [5, 5, 5, 255]))
        };
        let a = app("game", r"C:\Games\game.exe");
        let first = icon_png(dir.path(), &a, &extract).unwrap();
        let second = icon_png(dir.path(), &a, &extract).unwrap();
        assert_eq!(first, second);
        assert_eq!(calls.get(), 1);
        // Another target = another file: the icon is read again.
        icon_png(dir.path(), &app("game", r"D:\Other\game.exe"), &extract).unwrap();
        assert_eq!(calls.get(), 2);
    }

    #[test]
    fn links_and_unreadable_programs_have_no_icon() {
        let dir = tempfile::tempdir().unwrap();
        let mut link = app("site", "");
        link.launch = Launch::Url {
            url: "https://example.com".into(),
        };
        assert!(icon_png(dir.path(), &link, &|_| panic!("not asked")).is_none());
        assert!(icon_png(dir.path(), &app("x", r"C:\x.exe"), &|_| None).is_none());
    }

    #[test]
    fn forgetting_removes_only_that_apps_icons() {
        let dir = tempfile::tempdir().unwrap();
        let extract = |_: &str| Some(square(8, [1, 1, 1, 255]));
        icon_png(dir.path(), &app("game", r"C:\a.exe"), &extract).unwrap();
        icon_png(dir.path(), &app("game-2", r"C:\b.exe"), &extract).unwrap();
        forget(dir.path(), "game");
        let left: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(left.len(), 1);
        assert!(left[0].starts_with("game-2-"));
    }
}
