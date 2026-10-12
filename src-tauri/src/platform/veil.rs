//! A plain veil over the desktop (art direction round 4b): a native window of one colour whose
//! whole opacity Windows sets. With it the opaque `main` window disappears into the desktop, or
//! appears from it, in a fade when the widget takes over (or gives back): no WebView, no page, a
//! few kilobytes, and only during a passage. Click-through, never activated, out of Alt+Tab.
//!
//! Create, change and destroy it from the thread that runs the window event loop (its messages
//! are dispatched there).

use std::sync::OnceLock;

use windows::core::w;
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DwmSetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS,
    DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND, DWMWCP_ROUND,
};
use windows::Win32::Graphics::Gdi::{
    CreateSolidBrush, DeleteObject, FillRect, UpdateWindow, HBRUSH, HDC,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, GetClientRect, GetWindowLongPtrW,
    GetWindowRect, RegisterClassW, SetLayeredWindowAttributes, SetWindowLongPtrW, ShowWindow,
    GWLP_USERDATA, HTTRANSPARENT, LWA_ALPHA, MA_NOACTIVATE, SW_SHOWNOACTIVATE, WM_ERASEBKGND,
    WM_MOUSEACTIVATE, WM_NCDESTROY, WM_NCHITTEST, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
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

fn hwnd(raw: isize) -> HWND {
    HWND(raw as *mut _)
}

/// What a window really shows on screen: without the invisible resize borders of a framed
/// window (DWM's frame bounds), else its plain rectangle.
pub fn visible_rect(raw: isize) -> Option<ScreenRect> {
    let mut r = RECT::default();
    // SAFETY: reads into a local RECT of the right size; a stale handle just fails.
    let dwm = unsafe {
        DwmGetWindowAttribute(
            hwnd(raw),
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut r as *mut RECT as *mut _,
            std::mem::size_of::<RECT>() as u32,
        )
    };
    // SAFETY: same, plain read.
    if dwm.is_err() && unsafe { GetWindowRect(hwnd(raw), &mut r) }.is_err() {
        return None;
    }
    let (width, height) = (r.right - r.left, r.bottom - r.top);
    (width > 0 && height > 0).then_some(ScreenRect {
        x: r.left,
        y: r.top,
        width,
        height,
    })
}

extern "system" fn veil_proc(h: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    // SAFETY: standard window procedure; the brush lives in GWLP_USERDATA (set at creation,
    // deleted on WM_NCDESTROY), HDC comes from the system with WM_ERASEBKGND.
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

fn class() -> Option<u16> {
    static ATOM: OnceLock<u16> = OnceLock::new();
    let atom = *ATOM.get_or_init(|| {
        // SAFETY: registers a window class of this process once; the class name is static.
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
    (atom != 0).then_some(atom)
}

/// Shows a veil of colour `rgb` over `rect` at opacity `alpha` (0–255), above every window,
/// without taking the focus. `round`: Windows 11 rounded corners (over a framed window).
/// Returns its handle (`set_alpha`, `destroy`), None if Windows refused.
pub fn show(rect: ScreenRect, rgb: (u8, u8, u8), alpha: u8, round: bool) -> Option<isize> {
    class()?;
    let colour = COLORREF(u32::from(rgb.0) | u32::from(rgb.1) << 8 | u32::from(rgb.2) << 16);
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
        SetWindowLongPtrW(h, GWLP_USERDATA, CreateSolidBrush(colour).0 as isize);
        let corners = if round {
            DWMWCP_ROUND
        } else {
            DWMWCP_DONOTROUND
        };
        let _ = DwmSetWindowAttribute(
            h,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &corners as *const _ as *const _,
            std::mem::size_of_val(&corners) as u32,
        );
        let _ = SetLayeredWindowAttributes(h, COLORREF(0), alpha, LWA_ALPHA);
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
    // SAFETY: destroys a window created by `show` on this same thread; a stale handle fails.
    unsafe {
        let _ = DestroyWindow(hwnd(raw));
    }
}
