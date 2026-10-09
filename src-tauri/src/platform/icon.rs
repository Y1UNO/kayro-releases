//! Reading the icon the Shell shows for a program or a shortcut.

use std::mem::size_of;

use windows::core::PCWSTR;
use windows::Win32::Graphics::Gdi::{
    DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
};
use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
use windows::Win32::UI::Controls::IImageList;
use windows::Win32::UI::Shell::{
    SHGetFileInfoW, SHGetImageList, SHFILEINFOW, SHGFI_SYSICONINDEX, SHIL_JUMBO,
};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

use super::com::ComGuard;
use super::wide;

/// Straight (non-premultiplied) RGBA pixels, row by row from the top.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rgba {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

/// Owns a bitmap handle and frees it.
struct Bitmap(HBITMAP);

impl Drop for Bitmap {
    fn drop(&mut self) {
        if !self.0.is_invalid() {
            // SAFETY: the handle came from `GetIconInfo` and is released exactly once, here.
            unsafe {
                let _ = DeleteObject(HGDIOBJ(self.0 .0));
            }
        }
    }
}

struct Icon(HICON);

impl Drop for Icon {
    fn drop(&mut self) {
        // SAFETY: the icon came from `IImageList::GetIcon` and is destroyed exactly once, here.
        unsafe {
            let _ = DestroyIcon(self.0);
        }
    }
}

/// Reads the pixels of `bitmap` as 32-bit BGRA, top row first.
fn read_bgra(bitmap: &Bitmap) -> Option<(u32, u32, Vec<u8>)> {
    // SAFETY: `info`/`header` are plain structs filled in by the calls; the pixel buffer is sized
    // from the bitmap's own dimensions; the device context is released before returning.
    unsafe {
        let mut bm = BITMAP::default();
        if GetObjectW(
            HGDIOBJ(bitmap.0 .0),
            size_of::<BITMAP>() as i32,
            Some((&mut bm as *mut BITMAP).cast()),
        ) == 0
        {
            return None;
        }
        let (w, h) = (bm.bmWidth, bm.bmHeight);
        if w <= 0 || h <= 0 || w > 1024 || h > 1024 {
            return None;
        }
        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h, // negative: top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut buf = vec![0u8; (w as usize) * (h as usize) * 4];
        let dc = GetDC(None);
        let lines = GetDIBits(
            dc,
            bitmap.0,
            0,
            h as u32,
            Some(buf.as_mut_ptr().cast()),
            &mut info,
            DIB_RGB_COLORS,
        );
        ReleaseDC(None, dc);
        (lines != 0).then_some((w as u32, h as u32, buf))
    }
}

/// The large (up to 256 px) Shell icon of `path`, with its transparency. `None` when the file has
/// no icon the Shell can give. Needs no window; call it off the interface thread.
pub fn shell_icon(path: &str) -> Option<Rgba> {
    let _com = ComGuard::init();
    let file = wide(path);
    let mut info = SHFILEINFOW::default();
    // SAFETY: `file` is NUL-terminated and outlives the calls; `info` is a valid out structure;
    // every handle obtained below is wrapped in a guard that frees it.
    unsafe {
        let ok = SHGetFileInfoW(
            PCWSTR(file.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut info),
            size_of::<SHFILEINFOW>() as u32,
            SHGFI_SYSICONINDEX,
        );
        if ok == 0 {
            return None;
        }
        let list: IImageList = SHGetImageList(SHIL_JUMBO as i32).ok()?;
        let icon = Icon(list.GetIcon(info.iIcon, 1).ok()?); // 1 = ILD_TRANSPARENT
        let mut parts = ICONINFO::default();
        GetIconInfo(icon.0, &mut parts).ok()?;
        let colour = Bitmap(parts.hbmColor);
        let mask = Bitmap(parts.hbmMask);
        let (width, height, mut bgra) = read_bgra(&colour)?;

        // Icons without an alpha channel carry their shape in the mask (white = see-through).
        if bgra.as_chunks::<4>().0.iter().all(|p| p[3] == 0) {
            let shape = read_bgra(&mask).filter(|m| m.0 == width && m.1 == height);
            for (i, px) in bgra.as_chunks_mut::<4>().0.iter_mut().enumerate() {
                let see_through = shape.as_ref().is_some_and(|m| m.2[i * 4] != 0);
                px[3] = if see_through { 0 } else { 255 };
            }
        }
        for px in bgra.as_chunks_mut::<4>().0.iter_mut() {
            px.swap(0, 2); // BGRA -> RGBA
        }
        Some(Rgba {
            width,
            height,
            pixels: bgra,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notepad_has_an_icon_with_visible_pixels() {
        let windows = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        let icon = shell_icon(&format!(r"{windows}\System32\notepad.exe")).expect("icon");
        assert!(icon.width >= 16 && icon.height >= 16);
        assert_eq!(icon.pixels.len(), (icon.width * icon.height * 4) as usize);
        assert!(icon.pixels.as_chunks::<4>().0.iter().any(|p| p[3] > 0));
    }

    #[test]
    fn a_missing_file_gives_no_icon_or_a_generic_one_but_never_panics() {
        let _ = shell_icon(r"C:\definitely\missing\file.exe");
    }
}
