//! A plain veil over a screen (art direction round 4b), now Kayro's wake cover (2026-10-31):
//! started with Windows, the hub's screen goes dark at once with « Kayro · se réveille », long
//! before the page is ready, so the desktop is never seen first. A native window of one colour
//! whose whole opacity Windows sets: no WebView, no page, a few kilobytes. Click-through, never
//! activated, out of Alt+Tab.
//!
//! Create, change and destroy it from the thread that runs the window event loop (its messages
//! are dispatched there).

use std::sync::OnceLock;

use windows::core::w;
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, CreateFontW, CreateSolidBrush, DeleteObject, DrawTextW, EndPaint, FillRect,
    SelectObject, SetBkMode, SetTextColor, UpdateWindow, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS,
    DEFAULT_CHARSET, DT_CENTER, DT_SINGLELINE, DT_VCENTER, HBRUSH, HDC, OUT_DEFAULT_PRECIS,
    PAINTSTRUCT, TRANSPARENT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, GetClientRect, GetWindowLongPtrW,
    RegisterClassW, SetLayeredWindowAttributes, SetWindowLongPtrW, ShowWindow, GWLP_USERDATA,
    HTTRANSPARENT, LWA_ALPHA, MA_NOACTIVATE, SW_SHOWNOACTIVATE, WM_ERASEBKGND, WM_MOUSEACTIVATE,
    WM_NCDESTROY, WM_NCHITTEST, WM_PAINT, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
};

/// A rectangle of the screen, in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScreenRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// The two lines of the wake cover: the name, then what it does, in their colours.
#[derive(Debug, Clone, Copy)]
pub struct WakeText {
    pub title: &'static str,
    pub line: &'static str,
    pub title_rgb: (u8, u8, u8),
    pub line_rgb: (u8, u8, u8),
}

/// The text the veils of this process show (only the wake cover has one).
static TEXT: OnceLock<WakeText> = OnceLock::new();

fn hwnd(raw: isize) -> HWND {
    HWND(raw as *mut _)
}

fn colour((r, g, b): (u8, u8, u8)) -> COLORREF {
    COLORREF(u32::from(r) | u32::from(g) << 8 | u32::from(b) << 16)
}

/// One line of text centred on `centre_y`, `size` pixels high, light weight.
///
/// # Safety
/// `dc` is a device context being painted.
unsafe fn line(dc: HDC, client: &RECT, centre_y: i32, size: i32, text: &str, rgb: (u8, u8, u8)) {
    // SAFETY: the font is selected into `dc` for this line only, then the old one is put back
    // and the font deleted; the text buffer outlives the call.
    unsafe {
        let font = CreateFontW(
            -size,
            0,
            0,
            0,
            300,
            0,
            0,
            0,
            DEFAULT_CHARSET,
            OUT_DEFAULT_PRECIS,
            CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY,
            0,
            w!("Segoe UI Variable Display"),
        );
        let old = SelectObject(dc, font.into());
        SetTextColor(dc, colour(rgb));
        let mut r = RECT {
            left: client.left,
            right: client.right,
            top: centre_y - size,
            bottom: centre_y + size,
        };
        let mut wide: Vec<u16> = text.encode_utf16().collect();
        DrawTextW(dc, &mut wide, &mut r, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        SelectObject(dc, old);
        let _ = DeleteObject(font.into());
    }
}

extern "system" fn veil_proc(h: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    // SAFETY: standard window procedure; the brush lives in GWLP_USERDATA (set at creation,
    // deleted on WM_NCDESTROY), HDC comes from the system with WM_ERASEBKGND / BeginPaint.
    unsafe {
        match msg {
            WM_ERASEBKGND => {
                let brush = HBRUSH(GetWindowLongPtrW(h, GWLP_USERDATA) as *mut _);
                let mut rect = RECT::default();
                if !brush.is_invalid() && GetClientRect(h, &mut rect).is_ok() {
                    FillRect(HDC(wp.0 as *mut _), &rect, brush);
                }
                LRESULT(1)
            }
            WM_PAINT => {
                let mut ps = PAINTSTRUCT::default();
                let dc = BeginPaint(h, &mut ps);
                let mut client = RECT::default();
                if let (Some(t), Ok(())) = (TEXT.get(), GetClientRect(h, &mut client)) {
                    SetBkMode(dc, TRANSPARENT);
                    let height = client.bottom - client.top;
                    let mid = client.top + height / 2;
                    let big = (height / 14).max(24);
                    line(dc, &client, mid - big / 3, big, t.title, t.title_rgb);
                    let small = (height / 60).max(12);
                    line(dc, &client, mid + big / 2 + small, small, t.line, t.line_rgb);
                }
                let _ = EndPaint(h, &ps);
                LRESULT(0)
            }
            WM_NCHITTEST => LRESULT(HTTRANSPARENT as isize),
            WM_MOUSEACTIVATE => LRESULT(MA_NOACTIVATE as isize),
            WM_NCDESTROY => {
                let brush = SetWindowLongPtrW(h, GWLP_USERDATA, 0);
                if brush != 0 {
                    let _ = DeleteObject(HBRUSH(brush as *mut _).into());
                }
                DefWindowProcW(h, msg, wp, lp)
            }
            _ => DefWindowProcW(h, msg, wp, lp),
        }
    }
}

/// `cell`'s value, or `register`'s when it gives one (non-zero): a failure is not kept, the next
/// call tries again.
pub(crate) fn kept_nonzero(cell: &OnceLock<u16>, register: impl FnOnce() -> u16) -> Option<u16> {
    if let Some(&atom) = cell.get() {
        return Some(atom);
    }
    let atom = register();
    if atom == 0 {
        return None;
    }
    Some(*cell.get_or_init(|| atom))
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
                lpfnWndProc: Some(veil_proc),
                hInstance: instance,
                lpszClassName: w!("KayroVeil"),
                ..Default::default()
            })
        }
    });
    if atom.is_none() {
        tracing::warn!(error = %windows::core::Error::from_thread(), "veil window class refused");
    }
    atom
}

/// Shows the wake cover: a veil of colour `rgb` over `rect` with `text`, fully opaque, above
/// every window, without taking the focus. Returns its handle (`set_alpha`, `destroy`), None if
/// Windows refused.
pub fn show_wake(rect: ScreenRect, rgb: (u8, u8, u8), text: WakeText) -> Option<isize> {
    let _ = TEXT.set(text);
    class()?;
    // SAFETY: a top-level popup of this process, its brush handed to the window (deleted on
    // WM_NCDESTROY); every call takes the handle just created.
    unsafe {
        let instance = GetModuleHandleW(None).ok().map(Into::into);
        let h = CreateWindowExW(
            WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT,
            w!("KayroVeil"),
            w!(""),
            WS_POPUP,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            None,
            None,
            instance,
            None,
        )
        .ok()?;
        SetWindowLongPtrW(h, GWLP_USERDATA, CreateSolidBrush(colour(rgb)).0 as isize);
        let corners = DWMWCP_DONOTROUND;
        let _ = DwmSetWindowAttribute(
            h,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &corners as *const _ as *const _,
            std::mem::size_of_val(&corners) as u32,
        );
        let _ = SetLayeredWindowAttributes(h, COLORREF(0), 255, LWA_ALPHA);
        let _ = ShowWindow(h, SW_SHOWNOACTIVATE);
        let _ = UpdateWindow(h);
        Some(h.0 as isize)
    }
}

/// Sets the veil's opacity (0–255).
pub fn set_alpha(raw: isize, alpha: u8) {
    // SAFETY: a layered window of this process; a stale handle just fails.
    unsafe {
        let _ = SetLayeredWindowAttributes(hwnd(raw), COLORREF(0), alpha, LWA_ALPHA);
    }
}

pub fn destroy(raw: isize) {
    // SAFETY: destroys a window created by `show_wake` on this same thread; a stale handle fails.
    unsafe {
        let _ = DestroyWindow(hwnd(raw));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_refused_registration_is_tried_again_and_a_success_is_kept() {
        let cell = OnceLock::new();
        assert_eq!(kept_nonzero(&cell, || 0), None);
        assert_eq!(cell.get(), None);
        assert_eq!(kept_nonzero(&cell, || 42), Some(42));
        assert_eq!(kept_nonzero(&cell, || unreachable!()), Some(42));
    }
}
