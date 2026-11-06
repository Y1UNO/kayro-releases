//! « Mets One More Time de Daft Punk » (2026-11-05): Spotify's own search (Spotify goes
//! online, not Kayro), then the « Lire » of its first result is pressed. Only the page's main
//! part counts (its ARIA « main »: not the library, the queue or the player bar).

use std::time::Duration;

use windows::Win32::System::Variant::VARIANT;
use windows::Win32::UI::Accessibility::{
    IUIAutomation, IUIAutomationElement, TreeScope_Descendants, UIA_LandmarkTypePropertyId,
    UIA_MainLandmarkTypeId,
};

use super::{buttons, keep_looking, press, window, ComGuard, Pressed};

/// The words of a name (three letters or more), plain.
fn words(s: &str) -> Vec<String> {
    crate::voice::command::normalize(s)
        .split_whitespace()
        .filter(|w| w.chars().count() >= 3)
        .map(String::from)
        .collect()
}

/// The page's main part.
fn main_part(ui: &IUIAutomation, root: &IUIAutomationElement) -> Option<IUIAutomationElement> {
    // SAFETY: COM calls on objects of this thread; a stale element only makes them fail.
    unsafe {
        let main = VARIANT::from(UIA_MainLandmarkTypeId.0);
        let cond = ui
            .CreatePropertyCondition(UIA_LandmarkTypePropertyId, &main)
            .ok()?;
        root.FindFirst(TreeScope_Descendants, &cond).ok()
    }
}

/// What the main part shows now (its play buttons), to tell the search's results from it.
fn shown_now() -> Vec<String> {
    let _com = ComGuard::init();
    let Some(ui) = super::automation() else {
        return Vec::new();
    };
    // SAFETY: a COM call on this thread's object.
    let Some(root) = window().and_then(|h| unsafe { ui.ElementFromHandle(h) }.ok()) else {
        return Vec::new();
    };
    // Spotify fills its accessibility once asked: a few looks until it shows its page.
    let mut seen = Vec::new();
    for _ in 0..5 {
        if let Some(main) = main_part(&ui, &root) {
            seen = buttons(&ui, &main).into_iter().map(|b| b.what).collect();
            if !seen.is_empty() {
                break;
            }
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    seen
}

/// Searches `query` in Spotify and plays its first result: the highest play button of the
/// page's main part, once Spotify's results stop moving. Blocks: call it off the UI.
pub fn search_and_play(query: &str, wait: Duration) -> Pressed {
    let before = shown_now();
    let uri = format!(
        "spotify:search:{}",
        crate::voice::command::normalize(query).replace(' ', "%20")
    );
    if super::super::shell::shell_execute(&uri, &[], None, None).is_err() {
        return Pressed::NotFound;
    }
    // What the page showed before is no result (for four seconds: the same name can come
    // back as one). Results come in waves: the first one is pressed once it stays the same
    // between two looks.
    let mut last: Option<String> = None;
    keep_looking(wait, Duration::from_millis(800), move |ui, root, since| {
        let main = main_part(ui, root)?;
        let all = buttons(ui, &main);
        let fresh: Vec<&super::Button> = all
            .iter()
            .filter(|b| since > Duration::from_secs(4) || !before.contains(&b.what))
            .collect();
        // First the results with a word of the search (« Orelsan », not a song of the
        // moment); past 3 s, any.
        let asked = words(query);
        let matching = |b: &&&super::Button| words(&b.what).iter().any(|w| asked.contains(w));
        let first = fresh
            .iter()
            .filter(matching)
            .min_by_key(|b| (b.rect.top, b.rect.left))
            .or_else(|| {
                (since > Duration::from_secs(3))
                    .then(|| fresh.iter().min_by_key(|b| (b.rect.top, b.rect.left)))
                    .flatten()
            })?;
        if last.as_deref() == Some(first.what.as_str()) {
            return press(first);
        }
        last = Some(first.what.clone());
        None
    })
}
