//! Step 20 (Kysland): the effects' layer. A native window showing an image with its own
//! transparency, pixel by pixel (the glitch's spikes on the edge between two screens, or along
//! the top edge): it stays where the effect is while the island moves on, so nothing is cut by
//! the island's window. Click-through (clicks reach the windows below), never activated, out of
//! Alt+Tab and of the taskbar, no WebView: a few kilobytes, and an image only while an effect
//! shows.
//!
//! Create it on the thread that runs the window event loop; paint and hide it from any thread.

use std::sync::OnceLock;

use windows::core::w;
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, POINT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC, SelectObject,
    AC_SRC_ALPHA, AC_SRC_OVER, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, BLENDFUNCTION, DIB_RGB_COLORS,
    HGDIOBJ,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, RegisterClassW, SetWindowPos, ShowWindowAsync,
    UpdateLayeredWindow, HTTRANSPARENT, HWND_TOPMOST, MA_NOACTIVATE, SWP_ASYNCWINDOWPOS,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOWNOACTIVATE, ULW_ALPHA,
    WM_MOUSEACTIVATE, WM_NCHITTEST, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
};

use super::veil::kept_nonzero;

/// The largest image painted (physical pixels, each side).
pub const MAX_SIDE: u32 = 2400;

fn hwnd(raw: isize) -> HWND {
    HWND(raw as *mut _)
}

extern "system" fn overlay_proc(h: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    // SAFETY: standard window procedure of a window of this process.
    unsafe {
        match msg {
            WM_NCHITTEST => LRESULT(HTTRANSPARENT as isize),
            WM_MOUSEACTIVATE => LRESULT(MA_NOACTIVATE as isize),
            _ => DefWindowProcW(h, msg, wp, lp),
        }
    }
}

fn class() -> Option<u16> {
    static ATOM: OnceLock<u16> = OnceLock::new();
    let atom = kept_nonzero(&ATOM, || {
        // SAFETY: registers a window class of this process; the class name is static.
        unsafe {
            let instance = GetModuleHandleW(None)
                .ok()
                .map(Into::into)
                .unwrap_or_default();
            RegisterClassW(&WNDCLASSW {
                lpfnWndProc: Some(overlay_proc),
                hInstance: instance,
                lpszClassName: w!("KayroIslandFx"),
                ..Default::default()
            })
        }
    });
    if atom.is_none() {
        tracing::warn!(error = %windows::core::Error::from_thread(), "effects window class refused");
    }
    atom
}

/// Makes the (hidden) effects window; its handle, None if Windows refused.
pub fn create() -> Option<isize> {
    class()?;
    // SAFETY: a top-level popup of this process, hidden until its first image.
    unsafe {
        let instance = GetModuleHandleW(None).ok().map(Into::into);
        let h = CreateWindowExW(
            WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT,
            w!("KayroIslandFx"),
            w!(""),
            WS_POPUP,
            0,
            0,
            1,
            1,
            None,
            None,
            instance,
            None,
        )
        .ok()?;
        Some(h.0 as isize)
    }
}

/// Shows `pixels` (premultiplied BGRA, top-down rows of `width`) at `x`, `y` on the desktop,
/// just under the island's window `below`. False when Windows refused it.
pub fn paint(
    raw: isize,
    below: isize,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    pixels: &[u32],
) -> bool {
    paint_after(raw, Some(below), x, y, width, height, pixels)
}

/// As `paint`, above every window (the hands' glow under the cursor, step 22).
pub fn paint_top(raw: isize, x: i32, y: i32, width: u32, height: u32, pixels: &[u32]) -> bool {
    paint_after(raw, None, x, y, width, height, pixels)
}

fn paint_after(
    raw: isize,
    below: Option<isize>,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    pixels: &[u32],
) -> bool {
    let (w, h) = (width.clamp(1, MAX_SIDE), height.clamp(1, MAX_SIDE));
    if pixels.len() < (w * h) as usize {
        return false;
    }
    let info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w as i32,
            biHeight: -(h as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    // SAFETY: every handle made here is released before returning; `bits` points into the DIB
    // section (w × h pixels of 4 bytes), alive until `DeleteObject`.
    unsafe {
        let screen = GetDC(None);
        if screen.is_invalid() {
            return false;
        }
        let mem = CreateCompatibleDC(Some(screen));
        let mut bits = std::ptr::null_mut();
        let mut done = false;
        if let Ok(dib) = CreateDIBSection(Some(mem), &info, DIB_RGB_COLORS, &mut bits, None, 0) {
            if !bits.is_null() {
                let n = (w * h) as usize;
                std::ptr::copy_nonoverlapping(pixels.as_ptr(), bits as *mut u32, n);
                let old = SelectObject(mem, HGDIOBJ::from(dib));
                let blend = BLENDFUNCTION {
                    BlendOp: AC_SRC_OVER as u8,
                    BlendFlags: 0,
                    SourceConstantAlpha: 255,
                    AlphaFormat: AC_SRC_ALPHA as u8,
                };
                let at = POINT { x, y };
                let size = SIZE {
                    cx: w as i32,
                    cy: h as i32,
                };
                let from = POINT { x: 0, y: 0 };
                done = UpdateLayeredWindow(
                    hwnd(raw),
                    Some(screen),
                    Some(&at),
                    Some(&size),
                    Some(mem),
                    Some(&from),
                    COLORREF(0),
                    Some(&blend),
                    ULW_ALPHA,
                )
                .is_ok();
                SelectObject(mem, old);
            }
            let _ = DeleteObject(HGDIOBJ::from(dib));
        }
        let _ = DeleteDC(mem);
        ReleaseDC(None, screen);
        if done {
            let _ = ShowWindowAsync(hwnd(raw), SW_SHOWNOACTIVATE);
            // Under the island: the spikes come out from behind it.
            let flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS;
            let after = below.map_or(HWND_TOPMOST, hwnd);
            let _ = SetWindowPos(hwnd(raw), Some(after), 0, 0, 0, 0, flags);
        }
        done
    }
}

/// Moves the window, shown, keeping its image (the hands' glow between two paints).
pub fn place(raw: isize, x: i32, y: i32) {
    let flags = SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS;
    // SAFETY: a window of this process; a stale handle only makes the call fail.
    let _ = unsafe { SetWindowPos(hwnd(raw), None, x, y, 0, 0, flags) };
}

/// Hides the effects window (its image is dropped at the next paint).
pub fn hide(raw: isize) {
    // SAFETY: a window of this process; a stale handle only makes the call fail.
    let _ = unsafe { ShowWindowAsync(hwnd(raw), SW_HIDE) };
}
