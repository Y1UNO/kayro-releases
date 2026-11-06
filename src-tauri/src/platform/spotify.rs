//! « Mets ma playlist X » (2026-11-05): Spotify opens a playlist asked from outside, but plays
//! it only on a click. Its own « Lire : X » button (« Play X » in English), found through
//! Windows' accessibility (UI Automation, on this PC, nothing sent), is pressed once the page
//! shows it. Only Spotify's window, only that button.

use std::time::{Duration, Instant};

use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
use windows::Win32::System::Variant::VARIANT;
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationInvokePattern,
    TreeScope_Descendants, UIA_ButtonControlTypeId, UIA_ControlTypePropertyId, UIA_InvokePatternId,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindow, GetWindowTextLengthW, GetWindowThreadProcessId, IsWindowVisible,
    GW_OWNER,
};

use super::com::ComGuard;

#[path = "spotify_search.rs"]
mod search;
pub use search::search_and_play;

/// What came of it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pressed {
    Played,
    /// The playlist already plays (its button says « Mettre en pause »).
    Playing,
    /// No Spotify window, or no button of that playlist in time.
    NotFound,
}

/// Lower case letters and digits only: « Kiffe du moment » → « kiffedumoment ».
fn plain(s: &str) -> String {
    crate::voice::command::normalize(s).replace(' ', "")
}

/// Whether a button's playlist is the one asked: the same name, or one starting like it
/// (Spotify « Kiffe du moment », Kayro « Kiff du moment »; « HyperPoP », « Hyperpop »).
fn same(button: &str, wanted: &str) -> bool {
    let (b, w) = (plain(button), plain(wanted));
    if b.is_empty() || w.is_empty() {
        return false;
    }
    // A letter or two apart, for a long name (one in six).
    b == w || apart(&b, &w) <= (w.chars().count() / 6).max(1)
}

/// How many letters to change, add or remove to go from one to the other.
fn apart(a: &str, b: &str) -> usize {
    let b: Vec<char> = b.chars().collect();
    let mut row: Vec<usize> = (0..=b.len()).collect();
    for (i, x) in a.chars().enumerate() {
        let mut last = row[0];
        row[0] = i + 1;
        for (j, y) in b.iter().enumerate() {
            let here = row[j + 1];
            row[j + 1] = (last + usize::from(x != *y)).min(row[j] + 1).min(here + 1);
            last = here;
        }
    }
    row[b.len()]
}

/// The playlist a button plays or pauses, and whether it plays now.
fn button_of(name: &str) -> Option<(&str, bool)> {
    for (head, playing) in [
        ("Lire : ", false),
        ("Mettre en pause : ", true),
        ("Play ", false),
        ("Pause ", true),
    ] {
        if let Some(rest) = name.strip_prefix(head) {
            return Some((rest, playing));
        }
    }
    None
}

unsafe extern "system" fn visit(hwnd: HWND, lparam: LPARAM) -> BOOL {
    // SAFETY: `lparam` is the `&mut Option<HWND>` passed by `window`, alive for the call.
    let found = unsafe { &mut *(lparam.0 as *mut Option<HWND>) };
    // SAFETY: read-only queries on a handle EnumWindows just gave.
    let shown = unsafe {
        IsWindowVisible(hwnd).as_bool()
            && GetWindow(hwnd, GW_OWNER).is_err()
            && GetWindowTextLengthW(hwnd) > 0
    };
    if !shown {
        return BOOL(1);
    }
    let mut pid = 0u32;
    // SAFETY: `pid` outlives the call.
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    if super::process::exe_name(pid).as_deref() == Some("spotify.exe") {
        *found = Some(hwnd);
        return BOOL(0);
    }
    BOOL(1)
}

/// Spotify's main window.
fn window() -> Option<HWND> {
    let mut found: Option<HWND> = None;
    // SAFETY: the callback only touches `found`, which outlives the synchronous call; the
    // error of a callback stopping early is expected.
    unsafe {
        let _ = EnumWindows(
            Some(visit),
            LPARAM(&mut found as *mut Option<HWND> as isize),
        );
    }
    found
}

fn area(r: RECT) -> i64 {
    i64::from(r.right - r.left) * i64::from(r.bottom - r.top)
}

/// A « Lire : X » or « Mettre en pause : X » button of Spotify's window.
struct Button {
    /// X: the playlist, the track, the artist…
    what: String,
    playing: bool,
    rect: RECT,
    element: IUIAutomationElement,
}

/// The play and pause buttons under `root`, as Spotify's accessibility shows them now.
fn buttons(ui: &IUIAutomation, root: &IUIAutomationElement) -> Vec<Button> {
    let mut out = Vec::new();
    // SAFETY: COM calls on objects of this thread; a stale element only makes them fail.
    unsafe {
        let button = VARIANT::from(UIA_ButtonControlTypeId.0);
        let Ok(cond) = ui.CreatePropertyCondition(UIA_ControlTypePropertyId, &button) else {
            return out;
        };
        let Ok(all) = root.FindAll(TreeScope_Descendants, &cond) else {
            return out;
        };
        for i in 0..all.Length().unwrap_or(0) {
            let Ok(element) = all.GetElement(i) else {
                continue;
            };
            let Ok(name) = element.CurrentName() else {
                continue;
            };
            // French typography: a no-break space before the colon (« Lire : »).
            let name = name.to_string().replace(['\u{a0}', '\u{202f}'], " ");
            let Some((what, playing)) = button_of(&name) else {
                continue;
            };
            out.push(Button {
                what: what.to_string(),
                playing,
                rect: element.CurrentBoundingRectangle().unwrap_or_default(),
                element,
            });
        }
    }
    out
}

/// Presses a button found, unless it already plays.
fn press(b: &Button) -> Option<Pressed> {
    if b.playing {
        return Some(Pressed::Playing);
    }
    // SAFETY: COM calls on an element of this thread.
    unsafe {
        let invoke: IUIAutomationInvokePattern =
            b.element.GetCurrentPatternAs(UIA_InvokePatternId).ok()?;
        invoke.Invoke().ok()?;
    }
    Some(Pressed::Played)
}

/// Windows' automation object, on this thread.
fn automation() -> Option<IUIAutomation> {
    // SAFETY: plain creation of Windows' automation object on this thread.
    unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER) }.ok()
}

/// Looks at Spotify's window again and again until `wait` is over (the page opens, and
/// Spotify fills its accessibility only once asked), until `look` presses something. Blocks.
fn keep_looking(
    wait: Duration,
    settle: Duration,
    mut look: impl FnMut(&IUIAutomation, &IUIAutomationElement, Duration) -> Option<Pressed>,
) -> Pressed {
    let _com = ComGuard::init();
    let Some(ui) = automation() else {
        return Pressed::NotFound;
    };
    let started = Instant::now();
    std::thread::sleep(settle);
    loop {
        // SAFETY: a COM call on this thread's object; a stale window only makes it fail.
        let root = window().and_then(|hwnd| unsafe { ui.ElementFromHandle(hwnd) }.ok());
        if let Some(done) = root.and_then(|r| look(&ui, &r, started.elapsed())) {
            return done;
        }
        if started.elapsed() >= wait {
            return Pressed::NotFound;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
}

/// Presses play on the playlist `name` in Spotify (the playlist opened just before): its
/// largest button (the page's, larger than the library's). Blocks: call it off the UI.
pub fn play_playlist(name: &str, wait: Duration) -> Pressed {
    // The page needs a moment to show the playlist asked (else the library's button, already
    // there, would be pressed: same playlist, same result).
    keep_looking(wait, Duration::from_millis(600), |ui, root, _| {
        let all = buttons(ui, root);
        let best = all
            .iter()
            .filter(|b| same(&b.what, name))
            .max_by_key(|b| area(b.rect))?;
        press(best)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_button_of_the_playlist_asked_is_known_by_its_name() {
        assert_eq!(button_of("Lire : HyperPoP"), Some(("HyperPoP", false)));
        assert_eq!(
            button_of("Mettre en pause : Kiffe du moment"),
            Some(("Kiffe du moment", true))
        );
        assert_eq!(button_of("Lire BÊTISES par Celebii"), None);
        assert!(same("HyperPoP", "Hyperpop"));
        assert!(same("Kiffe du moment", "Kiff du moment"));
        assert!(same("FestiVal", "Festival"));
        assert!(!same("Français", "Festival"));
        assert!(!same("Chill", "Chanson BIENNG"));
        assert!(!same("Japonais", "Hyperpop"));
    }
}

/// By hand, on the PC's own Spotify (it plays!): `KAYRO_PLAYLIST=Hyperpop cargo test spotify -- --ignored`.
#[cfg(test)]
#[test]
#[ignore]
fn spotify_plays_the_playlist_named() {
    let name = std::env::var("KAYRO_PLAYLIST").unwrap_or_else(|_| "Hyperpop".into());
    let started = Instant::now();
    let done = play_playlist(&name, Duration::from_secs(12));
    println!("{done:?} in {} ms", started.elapsed().as_millis());
}

/// By hand, on the PC's own Spotify (it plays!): `KAYRO_SEARCH="daft punk" cargo test spotify_searches -- --ignored`.
#[cfg(test)]
#[test]
#[ignore]
fn spotify_searches_and_plays_the_first_result() {
    let q = std::env::var("KAYRO_SEARCH").unwrap_or_else(|_| "around the world daft punk".into());
    let started = Instant::now();
    let done = search_and_play(&q, Duration::from_secs(12));
    println!("{done:?} in {} ms", started.elapsed().as_millis());
}
