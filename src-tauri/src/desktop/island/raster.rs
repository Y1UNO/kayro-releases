//! Step 20 (Kysland): a small anti-aliased rasteriser for the effects' layer: filled polygons
//! (even-odd, four sub-rows per pixel row, exact coverage along each row), outlines as thin
//! quads, into premultiplied BGRA pixels (what a layered window shows). Pure, tested.

/// A point, in the image's pixels.
pub type Pt = (f64, f64);

/// An image of premultiplied BGRA pixels (`0xAARRGGBB` words), transparent at first.
pub struct Image {
    pub width: usize,
    pub height: usize,
    pub px: Vec<u32>,
}

const SUB_ROWS: usize = 4;

impl Image {
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            px: vec![0; width * height],
        }
    }

    /// Puts `rgb` (0xRRGGBB) at opacity `alpha × coverage` over the pixel `i` (source-over).
    fn blend(&mut self, i: usize, rgb: u32, a: f32) {
        let a = a.clamp(0.0, 1.0);
        if a <= 0.0 {
            return;
        }
        let d = self.px[i];
        let keep = 1.0 - a;
        let ch = |shift: u32, src: u32| {
            let s = ((src >> shift) & 0xff) as f32 * a;
            let t = ((d >> shift) & 0xff) as f32 * keep;
            ((s + t).round() as u32).min(255) << shift
        };
        let alpha = ((a * 255.0 + ((d >> 24) & 0xff) as f32 * keep).round() as u32).min(255);
        self.px[i] = alpha << 24 | ch(16, rgb) | ch(8, rgb) | ch(0, rgb);
    }

    /// Fills the polygon `pts` (even-odd) with `rgb` at opacity `alpha`, anti-aliased.
    pub fn fill(&mut self, pts: &[Pt], rgb: u32, alpha: f32) {
        if pts.len() < 3 || self.width == 0 || self.height == 0 {
            return;
        }
        let (min_y, max_y) = pts.iter().fold((f64::MAX, f64::MIN), |(lo, hi), p| {
            (lo.min(p.1), hi.max(p.1))
        });
        let (min_x, max_x) = pts.iter().fold((f64::MAX, f64::MIN), |(lo, hi), p| {
            (lo.min(p.0), hi.max(p.0))
        });
        let y0 = min_y.floor().max(0.0) as usize;
        let y1 = (max_y.ceil().max(0.0) as usize).min(self.height);
        let x0 = min_x.floor().max(0.0) as usize;
        let x1 = (max_x.ceil().max(0.0) as usize).min(self.width);
        if y0 >= y1 || x0 >= x1 {
            return;
        }
        let mut cover = vec![0f32; x1 - x0];
        let mut xs = Vec::with_capacity(8);
        for row in y0..y1 {
            cover.iter_mut().for_each(|c| *c = 0.0);
            for s in 0..SUB_ROWS {
                let sy = row as f64 + (s as f64 + 0.5) / SUB_ROWS as f64;
                xs.clear();
                for (i, a) in pts.iter().enumerate() {
                    let b = pts[(i + 1) % pts.len()];
                    if (a.1 <= sy && b.1 > sy) || (b.1 <= sy && a.1 > sy) {
                        xs.push(a.0 + (sy - a.1) * (b.0 - a.0) / (b.1 - a.1));
                    }
                }
                xs.sort_by(f64::total_cmp);
                for [a, b] in xs.as_chunks::<2>().0 {
                    let (from, to) = (a.max(x0 as f64), b.min(x1 as f64));
                    let mut x = from.floor() as usize;
                    while (x as f64) < to && x < x1 {
                        let left = from.max(x as f64);
                        let right = to.min(x as f64 + 1.0);
                        if right > left {
                            cover[x - x0] += ((right - left) / SUB_ROWS as f64) as f32;
                        }
                        x += 1;
                    }
                }
            }
            for (k, c) in cover.iter().enumerate() {
                if *c > 0.0 {
                    self.blend(row * self.width + x0 + k, rgb, alpha * c.min(1.0));
                }
            }
        }
    }

    /// Outlines the closed polygon `pts` with a line `width` wide.
    pub fn stroke(&mut self, pts: &[Pt], rgb: u32, alpha: f32, width: f64) {
        let half = width / 2.0;
        for (i, a) in pts.iter().enumerate() {
            let b = pts[(i + 1) % pts.len()];
            let (dx, dy) = (b.0 - a.0, b.1 - a.1);
            let len = dx.hypot(dy);
            if len < 1e-6 {
                continue;
            }
            let (nx, ny) = (-dy / len * half, dx / len * half);
            let quad = [
                (a.0 + nx, a.1 + ny),
                (b.0 + nx, b.1 + ny),
                (b.0 - nx, b.1 - ny),
                (a.0 - nx, a.1 - ny),
            ];
            self.fill(&quad, rgb, alpha);
        }
    }

    /// The opacity (0–255) of the pixel at `x`, `y` (tests).
    pub fn alpha_at(&self, x: usize, y: usize) -> u32 {
        self.px[y * self.width + x] >> 24
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_filled_square_covers_its_pixels_and_only_them() {
        let mut img = Image::new(10, 10);
        img.fill(
            &[(2.0, 2.0), (6.0, 2.0), (6.0, 6.0), (2.0, 6.0)],
            0xff0000,
            1.0,
        );
        assert_eq!(img.alpha_at(3, 3), 255);
        assert_eq!(img.px[3 * 10 + 3], 0xffff_0000, "premultiplied red");
        assert_eq!(img.alpha_at(1, 3), 0);
        assert_eq!(img.alpha_at(6, 3), 0);
    }

    #[test]
    fn edges_are_anti_aliased() {
        let mut img = Image::new(10, 10);
        img.fill(
            &[(2.5, 2.0), (6.0, 2.0), (6.0, 6.0), (2.5, 6.0)],
            0xffffff,
            1.0,
        );
        let half = img.alpha_at(2, 3);
        assert!((120..=135).contains(&half), "half a pixel covered: {half}");
        // A diagonal edge: partly covered pixels along it.
        let mut tri = Image::new(10, 10);
        tri.fill(&[(0.0, 0.0), (10.0, 0.0), (0.0, 10.0)], 0xffffff, 1.0);
        let edge = tri.alpha_at(4, 5);
        assert!(edge > 0 && edge < 255);
    }

    #[test]
    fn layers_add_up_like_source_over() {
        let mut img = Image::new(4, 4);
        let sq = [(0.0, 0.0), (4.0, 0.0), (4.0, 4.0), (0.0, 4.0)];
        img.fill(&sq, 0x0000ff, 0.5);
        img.fill(&sq, 0x0000ff, 0.5);
        assert!(
            (190..=192).contains(&img.alpha_at(1, 1)),
            "0.5 over 0.5 = 0.75"
        );
    }

    #[test]
    fn an_outline_leaves_the_inside_empty_and_shapes_outside_are_skipped() {
        let mut img = Image::new(20, 20);
        img.stroke(
            &[(4.0, 4.0), (16.0, 4.0), (16.0, 16.0), (4.0, 16.0)],
            0x8b3dff,
            1.0,
            1.2,
        );
        assert!(
            img.alpha_at(10, 3) > 100 && img.alpha_at(10, 4) > 100,
            "a line over two rows"
        );
        assert_eq!(img.alpha_at(10, 10), 0);
        img.fill(
            &[(-30.0, -30.0), (-10.0, -30.0), (-10.0, -10.0)],
            0xffffff,
            1.0,
        );
        img.fill(&[(1.0, 1.0)], 0xffffff, 1.0);
        assert_eq!(img.alpha_at(0, 0), 0);
    }
}
