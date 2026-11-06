//! Step 20 (Kysland): the music playing, read from Windows' media controls (the players it shows
//! in its volume flyout: Spotify, a browser, any player). Local and read only, except three
//! controls: previous, play/pause, next. Nothing is sent anywhere.

use std::sync::{Arc, Mutex};

use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
use windows::Media::MediaPlaybackAutoRepeatMode;
use windows::Storage::Streams::{Buffer, DataReader, InputStreamOptions};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

/// A cover larger than this is not read.
const MAX_COVER: u64 = 4 * 1024 * 1024;
/// 100 ns ticks between 1601-01-01 (Windows) and 1970-01-01 (Unix).
const UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;

/// What a player says it plays.
#[derive(Debug, Clone, PartialEq)]
pub struct Track {
    pub title: String,
    pub artist: String,
    /// The player's app id (`Spotify.exe`, a browser's…).
    pub player: String,
    pub playing: bool,
    pub position_ms: f64,
    pub duration_ms: f64,
    /// When `position_ms` was read, in ms since the Unix epoch (0 when unknown).
    pub at_ms: f64,
}

/// COM in the multithreaded apartment on this thread (WinRT calls from a background thread).
pub fn mta() {
    // SAFETY: plain initialisation; « already initialised » (any mode) is fine for these calls.
    let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
}

pub fn manager() -> Option<Manager> {
    mta();
    Manager::RequestAsync().ok()?.join().ok()
}

fn is_spotify(s: &Session) -> bool {
    s.SourceAppUserModelId()
        .map(|id| id.to_string().to_lowercase().contains("spotify"))
        .unwrap_or(false)
}

fn is_playing(s: &Session) -> bool {
    s.GetPlaybackInfo()
        .and_then(|p| p.PlaybackStatus())
        .map(|st| st == Status::Playing)
        .unwrap_or(false)
}

fn sessions(m: &Manager) -> Vec<Session> {
    let Ok(list) = m.GetSessions() else {
        return Vec::new();
    };
    let n = list.Size().unwrap_or(0);
    (0..n).filter_map(|i| list.GetAt(i).ok()).collect()
}

/// The player shown: Spotify when it plays, else one that plays, else Windows' current one,
/// else a paused Spotify.
pub fn pick(m: &Manager) -> Option<Session> {
    let all = sessions(m);
    all.iter()
        .find(|s| is_spotify(s) && is_playing(s))
        .or_else(|| all.iter().find(|s| is_playing(s)))
        .cloned()
        .or_else(|| m.GetCurrentSession().ok())
        .or_else(|| all.iter().find(|s| is_spotify(s)).cloned())
}

/// The track a player shows now (None when it shows no title).
pub fn read(s: &Session) -> Option<Track> {
    let props = s.TryGetMediaPropertiesAsync().ok()?.join().ok()?;
    let title = props.Title().ok()?.to_string();
    if title.trim().is_empty() {
        return None;
    }
    let artist = props.Artist().map(|a| a.to_string()).unwrap_or_default();
    let player = s
        .SourceAppUserModelId()
        .map(|p| p.to_string())
        .unwrap_or_default();
    let (mut position_ms, mut duration_ms, mut at_ms) = (0.0, 0.0, 0.0);
    if let Ok(t) = s.GetTimelineProperties() {
        let ms = |ticks: i64| ticks as f64 / 10_000.0;
        position_ms = t.Position().map(|p| ms(p.Duration)).unwrap_or(0.0);
        duration_ms = t.EndTime().map(|p| ms(p.Duration)).unwrap_or(0.0);
        at_ms = t
            .LastUpdatedTime()
            .map(|d| ms(d.UniversalTime - UNIX_EPOCH_TICKS))
            .unwrap_or(0.0)
            .max(0.0);
    }
    Some(Track {
        title,
        artist,
        player,
        playing: is_playing(s),
        position_ms,
        duration_ms,
        at_ms,
    })
}

/// The cover's bytes (JPEG or PNG), as the player gives it.
pub fn cover(s: &Session) -> Option<Vec<u8>> {
    let props = s.TryGetMediaPropertiesAsync().ok()?.join().ok()?;
    let stream = props.Thumbnail().ok()?.OpenReadAsync().ok()?.join().ok()?;
    let size = stream.Size().ok()?.min(MAX_COVER) as u32;
    if size == 0 {
        return None;
    }
    let buffer = Buffer::Create(size).ok()?;
    let read = stream
        .ReadAsync(&buffer, size, InputStreamOptions::None)
        .ok()?
        .join()
        .ok()?;
    let len = read.Length().ok()? as usize;
    let mut bytes = vec![0u8; len];
    DataReader::FromBuffer(&read)
        .ok()?
        .ReadBytes(&mut bytes)
        .ok()?;
    Some(bytes)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Control {
    Previous,
    Toggle,
    Next,
    /// Step 21 (« mets la musique », « mets pause »): play or pause, not a toggle.
    Play,
    Pause,
    /// Shuffle on or off, repeat (the list) on or off.
    Shuffle(bool),
    Repeat(bool),
}

/// Asks the player shown to go back, pause or play, or skip.
pub fn control(m: &Manager, what: Control) -> bool {
    mta();
    pick(m).is_some_and(|s| run(&s, what))
}

/// The same on one app's player (« mets play sur Comet »): the first whose app id holds one of
/// `hints` (lower case: `comet`, `msedge`); None when that app shows no player.
pub fn control_of(m: &Manager, what: Control, hints: &[String]) -> Option<bool> {
    mta();
    let all = sessions(m);
    let s = all.iter().find(|s| {
        s.SourceAppUserModelId().is_ok_and(|id| {
            let id = id.to_string().to_lowercase();
            hints.iter().any(|h| id.contains(h.as_str()))
        })
    })?;
    Some(run(s, what))
}

fn run(s: &Session, what: Control) -> bool {
    let op = match what {
        Control::Previous => s.TrySkipPreviousAsync(),
        Control::Toggle => s.TryTogglePlayPauseAsync(),
        Control::Next => s.TrySkipNextAsync(),
        Control::Play => s.TryPlayAsync(),
        Control::Pause => s.TryPauseAsync(),
        Control::Shuffle(on) => s.TryChangeShuffleActiveAsync(on),
        Control::Repeat(on) => s.TryChangeAutoRepeatModeAsync(if on {
            MediaPlaybackAutoRepeatMode::List
        } else {
            MediaPlaybackAutoRepeatMode::None
        }),
    };
    op.ok().and_then(|o| o.join().ok()).unwrap_or(false)
}

type Tokens = (Session, i64, i64, i64);

/// A handler of any event of a player that just says « something changed ».
fn relay<A: windows::core::RuntimeType + 'static>(
    changed: &Arc<dyn Fn() + Send + Sync>,
) -> TypedEventHandler<Session, A> {
    let changed = changed.clone();
    TypedEventHandler::new(move |_, _| {
        changed();
        Ok(())
    })
}

/// Calls `changed` whenever a player starts, stops, changes track, plays or pauses, or seeks.
/// The handlers live as long as `m`.
pub fn follow(m: &Manager, changed: Arc<dyn Fn() + Send + Sync>) {
    let followed: Arc<Mutex<Vec<Tokens>>> = Arc::new(Mutex::new(Vec::new()));
    let attach = {
        let changed = changed.clone();
        let followed = followed.clone();
        move |m: &Manager| {
            let mut list = followed.lock().unwrap_or_else(|e| e.into_inner());
            for (s, a, b, c) in list.drain(..) {
                let _ = s.RemoveMediaPropertiesChanged(a);
                let _ = s.RemovePlaybackInfoChanged(b);
                let _ = s.RemoveTimelinePropertiesChanged(c);
            }
            for s in sessions(m) {
                let a = s.MediaPropertiesChanged(&relay(&changed));
                let b = s.PlaybackInfoChanged(&relay(&changed));
                let c = s.TimelinePropertiesChanged(&relay(&changed));
                if let (Ok(a), Ok(b), Ok(c)) = (a, b, c) {
                    list.push((s, a, b, c));
                }
            }
        }
    };
    attach(m);
    let on_sessions = {
        let changed = changed.clone();
        move |sender: windows::core::Ref<Manager>, _: windows::core::Ref<_>| {
            if let Some(m) = sender.as_ref() {
                attach(m);
            }
            changed();
            Ok(())
        }
    };
    let _ = m.SessionsChanged(&TypedEventHandler::new(on_sessions));
    let on_current = move |_: windows::core::Ref<Manager>, _: windows::core::Ref<_>| {
        changed();
        Ok(())
    };
    let _ = m.CurrentSessionChanged(&TypedEventHandler::new(on_current));
}
