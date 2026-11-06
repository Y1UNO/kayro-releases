//! Step 20 (Kysland): the Win32 side of the island's window. The cursor and the mouse button
//! (read while a gesture runs), the composition's beat (`DwmFlush`: one move per frame the
//! screen shows), moving the window, its click region (outside the island, clicks go to the
//! windows below), no frame of Windows' own around it, the lightness of the screen around it (its
//! colours follow it), and whether a full-screen program is in front on the island's screen.

use windows::Win32::Foundation::{HWND, POINT, RECT};
use windows::Win32::Graphics::Dwm::{
    DwmFlush, DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_COLOR_NONE,
    DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
};
use windows::Win32::Graphics::Gdi::{
    CombineRgn, CreateCompatibleDC, CreateDIBSection, CreatePolygonRgn, CreateRectRgn,
    CreateRoundRectRgn, DeleteDC, DeleteObject, GetDC, GetMonitorInfoW, MonitorFromWindow,
    ReleaseDC, SelectObject, SetBrushOrgEx, SetStretchBltMode, SetWindowRgn, StretchBlt,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HALFTONE, HGDIOBJ, MONITORINFO,
    MONITOR_DEFAULTTONEAREST, RGN_OR, SRCCOPY, WINDING,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON, VK_RBUTTON};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetCursorPos, GetForegroundWindow, GetSystemMetrics, GetWindowLongPtrW,
    GetWindowRect, GetWindowThreadProcessId, IsWindow, SetWindowLongPtrW, SetWindowPos,
    ShowWindowAsync, GWL_STYLE, SM_SWAPBUTTON, SWP_ASYNCWINDOWPOS, SWP_FRAMECHANGED,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOWNOACTIVATE, WS_CAPTION,
    WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU, WS_THICKFRAME,
};

fn hwnd(raw: isize) -> HWND {
    HWND(raw as *mut _)
}

/// The cursor, in physical pixels of the desktop.
pub fn cursor() -> Option<(i32, i32)> {
    let mut p = POINT::default();
    // SAFETY: `p` outlives the call.
    unsafe { GetCursorPos(&mut p) }.ok().map(|_| (p.x, p.y))
}

/// The primary mouse button is down (the right one when the buttons are swapped).
pub fn primary_held() -> bool {
    // SAFETY: plain queries.
    unsafe {
        let key = if GetSystemMetrics(SM_SWAPBUTTON) != 0 {
            VK_RBUTTON
        } else {
            VK_LBUTTON
        };
        GetAsyncKeyState(i32::from(key.0)) as u16 & 0x8000 != 0
    }
}

/// Waits for the next frame of the desktop's composition; false when there is none to wait for.
pub fn next_frame() -> bool {
    // SAFETY: no arguments.
    unsafe { DwmFlush() }.is_ok()
}

/// The window still exists.
pub fn alive(raw: isize) -> bool {
    // SAFETY: a stale handle only answers false.
    unsafe { IsWindow(Some(hwnd(raw))) }.as_bool()
}

/// Moves the window (posted to its thread: the gesture's thread never waits on the interface).
pub fn move_to(raw: isize, x: i32, y: i32) {
    let flags = SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS;
    // SAFETY: a stale handle only makes the call fail.
    let _ = unsafe { SetWindowPos(hwnd(raw), None, x, y, 0, 0, flags) };
}

/// Moves and sizes the window at once (Kysland's music mode covers its screen, then goes back).
pub fn place(raw: isize, x: i32, y: i32, width: i32, height: i32) {
    no_caption(raw);
    let flags = SWP_NOZORDER | SWP_NOACTIVATE;
    // SAFETY: a stale handle only makes the call fail.
    let _ = unsafe { SetWindowPos(hwnd(raw), None, x, y, width, height, flags) };
}

/// A plain popup, without the caption's styles the window was made with (2026-11-03): Windows
/// sometimes painted that caption, a light grey band 8–33 px from the top, under the page; it
/// showed wherever the page is transparent and the region reached the top (the music mode).
fn no_caption(raw: isize) {
    let caption = (WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX).0;
    // SAFETY: plain queries and changes of a window's style; a stale handle makes them fail.
    unsafe {
        let style = GetWindowLongPtrW(hwnd(raw), GWL_STYLE) as u32;
        if style & caption == 0 {
            return;
        }
        let plain = (style & !caption) | WS_POPUP.0;
        SetWindowLongPtrW(hwnd(raw), GWL_STYLE, plain as isize);
        let flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED;
        let _ = SetWindowPos(hwnd(raw), None, 0, 0, 0, 0, flags);
    }
}

/// Where clicks land and what shows: a (rounded) rectangle of the window, or the outline of a
/// shape (its bounds then in `x`… `height`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Region {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    /// Diameter of the corners' rounding, 0 for square corners.
    pub round: i32,
    /// The shape's outline (physical pixels of the window), empty for a rectangle.
    pub outline: Vec<(i32, i32)>,
}

pub fn set_region(raw: isize, region: Option<Region>) {
    // SAFETY: the region made here is handed to the window, which owns it from then on.
    unsafe {
        let made = region.map(|r| {
            let (x1, y1) = (r.x + r.width, r.y + r.height);
            if r.outline.len() >= 3 {
                let pts: Vec<POINT> = r.outline.iter().map(|&(x, y)| POINT { x, y }).collect();
                CreatePolygonRgn(&pts, WINDING)
            } else if r.round > 0 {
                CreateRoundRectRgn(r.x, r.y, x1 + 1, y1 + 1, r.round, r.round)
            } else {
                CreateRectRgn(r.x, r.y, x1, y1)
            }
        });
        SetWindowRgn(hwnd(raw), made, true);
    }
}

/// The region as several rectangles (x, y, width, height; physical pixels of the window):
/// Kysland's music mode, around each thing it draws. None: nothing shows, no click is taken.
pub fn set_region_rects(raw: isize, rects: &[(i32, i32, i32, i32)]) {
    // SAFETY: each rectangle's region is merged into `all` then deleted; `all` is handed to the
    // window, which owns it from then on.
    unsafe {
        let all = CreateRectRgn(0, 0, 0, 0);
        for &(x, y, w, h) in rects {
            let one = CreateRectRgn(x, y, x + w, y + h);
            CombineRgn(Some(all), Some(all), Some(one), RGN_OR);
            let _ = DeleteObject(HGDIOBJ::from(one));
        }
        SetWindowRgn(hwnd(raw), Some(all), true);
    }
}

/// No caption, no border and no rounded corners of Windows 11 around the window, whatever its
/// region (the island draws its own edges). Earlier versions of Windows ignore the last two.
pub fn plain_frame(raw: isize) {
    no_caption(raw);
    let none = DWMWA_COLOR_NONE;
    let square = DWMWCP_DONOTROUND;
    // SAFETY: each value outlives its call, and its size is the one passed.
    unsafe {
        let _ = DwmSetWindowAttribute(
            hwnd(raw),
            DWMWA_BORDER_COLOR,
            (&raw const none).cast(),
            size_of::<u32>() as u32,
        );
        let _ = DwmSetWindowAttribute(
            hwnd(raw),
            DWMWA_WINDOW_CORNER_PREFERENCE,
            (&raw const square).cast(),
            size_of_val(&square) as u32,
        );
    }
}

/// Cells the measured area is shrunk to (the screen's pixels are averaged by Windows).
const CELLS: (i32, i32) = (32, 14);

/// Perceived lightness (CIE L*, 0–1) of one sRGB colour.
pub fn lightness_of(r: u8, g: u8, b: u8) -> f32 {
    let lin = |c: u8| {
        let c = f32::from(c) / 255.0;
        if c <= 0.040_45 {
            c / 12.92
        } else {
            ((c + 0.055) / 1.055).powf(2.4)
        }
    };
    let y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    let f = if y > 216.0 / 24389.0 {
        y.cbrt()
    } else {
        (24389.0 / 27.0 * y + 16.0) / 116.0
    };
    ((116.0 * f - 16.0) / 100.0).clamp(0.0, 1.0)
}

/// Mean lightness (0–1) of the screen's pixels in `area` (x, y, width, height, physical), the
/// `hole` left out (the island itself). One small read of the screen, averaged at once:
/// nothing is kept, nothing leaves the PC.
pub fn lightness(area: (i32, i32, i32, i32), hole: (i32, i32, i32, i32)) -> Option<f32> {
    let (x, y, w, h) = area;
    if w < CELLS.0 || h < CELLS.1 {
        return None;
    }
    let info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: CELLS.0,
            biHeight: -CELLS.1,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    // SAFETY: every handle made here is released before returning; `bits` points into the DIB
    // section, alive until `DeleteObject`, and holds CELLS.0 × CELLS.1 pixels of 4 bytes.
    unsafe {
        let screen = GetDC(None);
        if screen.is_invalid() {
            return None;
        }
        let mem = CreateCompatibleDC(Some(screen));
        let mut bits = std::ptr::null_mut();
        let made = CreateDIBSection(Some(mem), &info, DIB_RGB_COLORS, &mut bits, None, 0);
        let mut out = None;
        if let Ok(dib) = made {
            let old = SelectObject(mem, HGDIOBJ::from(dib));
            SetStretchBltMode(mem, HALFTONE);
            let _ = SetBrushOrgEx(mem, 0, 0, None);
            let copied = StretchBlt(
                mem,
                0,
                0,
                CELLS.0,
                CELLS.1,
                Some(screen),
                x,
                y,
                w,
                h,
                SRCCOPY,
            );
            if copied.as_bool() && !bits.is_null() {
                let len = (CELLS.0 * CELLS.1 * 4) as usize;
                let px = std::slice::from_raw_parts(bits as *const u8, len);
                out = mean_outside(px, area, hole);
            }
            SelectObject(mem, old);
            let _ = DeleteObject(HGDIOBJ::from(dib));
        }
        let _ = DeleteDC(mem);
        ReleaseDC(None, screen);
        out
    }
}

/// The mean lightness of the cells (BGRA) whose centre is outside `hole`.
fn mean_outside(px: &[u8], area: (i32, i32, i32, i32), hole: (i32, i32, i32, i32)) -> Option<f32> {
    let (x, y, w, h) = area;
    let (hx, hy, hw, hh) = hole;
    let (mut sum, mut n) = (0.0f32, 0u32);
    for row in 0..CELLS.1 {
        for col in 0..CELLS.0 {
            let cx = x + (2 * col + 1) * w / (2 * CELLS.0);
            let cy = y + (2 * row + 1) * h / (2 * CELLS.1);
            if cx >= hx && cx < hx + hw && cy >= hy && cy < hy + hh {
                continue;
            }
            let i = ((row * CELLS.0 + col) * 4) as usize;
            sum += lightness_of(px[i + 2], px[i + 1], px[i]);
            n += 1;
        }
    }
    (n > 0).then(|| sum / n as f32)
}

/// Shows (without taking the focus) or hides the window, from any thread.
pub fn show_quietly(raw: isize, shown: bool) {
    let how = if shown { SW_SHOWNOACTIVATE } else { SW_HIDE };
    // SAFETY: a stale handle only makes the call fail.
    let _ = unsafe { ShowWindowAsync(hwnd(raw), how) };
}

/// The desktop's own windows, which cover a screen without being a program in full screen.
pub(super) const SHELL_CLASSES: &[&str] = &[
    "Progman",
    "WorkerW",
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
];

/// Windows' own passing windows that take the focus without being a program in front: the Start
/// menu and the search, Alt+Tab and the task view, menus, the notification area's overflow.
const PASSING_CLASSES: &[&str] = &[
    "Windows.UI.Core.CoreWindow",
    "XamlExplorerHostIslandWindow",
    "MultitaskingViewFrame",
    "TaskSwitcherWnd",
    "ForegroundStaging",
    "NotifyIconOverflowWindow",
    "TopLevelWindowForOverflowXamlIsland",
    "#32768",
];

/// Another program's window is in front (not one of this process, not the desktop, the taskbar
/// or one of Windows' passing windows).
pub fn other_program_in_front(own: u32) -> bool {
    // SAFETY: read-only queries; a stale handle only makes them fail.
    unsafe {
        let front = GetForegroundWindow();
        if front.is_invalid() {
            return false;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(front, Some(&mut pid));
        let class = class_of(front);
        pid != 0
            && pid != own
            && !SHELL_CLASSES.contains(&class.as_str())
            && !PASSING_CLASSES.contains(&class.as_str())
    }
}

pub(crate) fn class_of(h: HWND) -> String {
    let mut buf = [0u16; 64];
    // SAFETY: the buffer outlives the call.
    let n = unsafe { GetClassNameW(h, &mut buf) }.max(0) as usize;
    String::from_utf16_lossy(&buf[..n.min(buf.len())])
}

pub(super) fn monitor_rect(h: HWND) -> Option<RECT> {
    let mut info = MONITORINFO {
        cbSize: size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    // SAFETY: `info` outlives the call.
    let ok = unsafe { GetMonitorInfoW(MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST), &mut info) };
    ok.as_bool().then_some(info.rcMonitor)
}

/// The window in front belongs to another program and covers all of the island's screen (a game,
/// a video in full screen). `own` is this process: the hub's own windows never count.
pub fn full_screen_in_front(island: isize, own: u32) -> bool {
    // SAFETY: read-only queries; a stale handle only makes them fail.
    unsafe {
        let front = GetForegroundWindow();
        if front.is_invalid() {
            return false;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(front, Some(&mut pid));
        if pid == own || SHELL_CLASSES.contains(&class_of(front).as_str()) {
            return false;
        }
        let mut rect = RECT::default();
        if GetWindowRect(front, &mut rect).is_err() {
            return false;
        }
        let (Some(theirs), Some(ours)) = (monitor_rect(front), monitor_rect(hwnd(island))) else {
            return false;
        };
        theirs == ours
            && rect.left <= theirs.left
            && rect.top <= theirs.top
            && rect.right >= theirs.right
            && rect.bottom >= theirs.bottom
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lightness_reads_like_the_eye() {
        assert_eq!(lightness_of(0, 0, 0), 0.0);
        assert!((lightness_of(255, 255, 255) - 1.0).abs() < 1e-3);
        assert!((lightness_of(119, 119, 119) - 0.5).abs() < 0.01, "mid grey");
        assert!(
            lightness_of(0, 255, 0) > lightness_of(0, 0, 255),
            "green looks lighter"
        );
    }

    #[test]
    fn the_island_itself_is_left_out_of_the_mean() {
        // White everywhere but a black band in the middle (the island), left out by the hole.
        let mut px = vec![255u8; (CELLS.0 * CELLS.1 * 4) as usize];
        for row in 4..10 {
            for col in 8..24 {
                let i = ((row * CELLS.0 + col) * 4) as usize;
                px[i..i + 3].fill(0);
            }
        }
        let area = (0, 0, CELLS.0 * 10, CELLS.1 * 10);
        let hole = (80, 40, 160, 60);
        assert!((mean_outside(&px, area, hole).unwrap() - 1.0).abs() < 1e-3);
        assert!(mean_outside(&px, area, (0, 0, 0, 0)).unwrap() < 0.9);
    }
}
