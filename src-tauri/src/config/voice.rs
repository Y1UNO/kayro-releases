//! Step 21, the voice: its settings (Réglages › Assistant vocal et IA). Off by default: the
//! microphone is never opened until the user picks a mode.

use serde::{Deserialize, Serialize};
use specta::Type;

/// How Kayro listens.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum VoiceMode {
    #[default]
    Off,
    /// The microphone opens only while the shortcut is held.
    PushToTalk,
    /// Always listening for the wake word (the user's exception to « never the microphone all
    /// the time », 2026-10-30): speech detection, then the wake word, then the command.
    Always,
}

/// Which model writes down the command (the wake word always uses the small French one).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum VoiceModel {
    /// NVIDIA Parakeet TDT 0.6B v3: the best French and English names (~730 MB of memory).
    #[default]
    Parakeet,
    /// NVIDIA Canary 180M Flash: lighter (~320 MB), weaker on English names.
    Canary,
}

pub const WAKE_WORD_DEFAULT: &str = "Hé Kayro";
pub const VOICE_HOTKEY_DEFAULT: &str = "Ctrl+Alt+V";
const WAKE_WORD_MAX: usize = 40;

/// Read as a whole: a settings file without it (older), or with a broken one, keeps the default
/// (the settings' lenient read, field by field).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSettings {
    pub mode: VoiceMode,
    /// Said before a command in the « always » mode; the user's own (the assistant's name comes
    /// later, with the ecosystem's AI app).
    pub wake_word: String,
    /// The push-to-talk shortcut (empty: none).
    pub hotkey: String,
    pub model: VoiceModel,
    /// Keep listening while a program in full screen (a game) is in front; off: the
    /// microphone closes until it leaves (push-to-talk still works).
    pub in_game: bool,
    /// What the small model heard when the user taught it the wake word (« DIOUNOV »): matched
    /// too. Emptied when the wake word changes.
    pub wake_heard: Vec<String>,
    /// The microphone's Windows id (empty: Windows' default one).
    pub microphone: String,
    /// The output whose sound the echo canceller takes out, by Windows id (empty: the default
    /// one; with Voicemeeter, the physical speakers hold every bus).
    pub speakers: String,
    /// The island's aura while it listens: empty = the island's own colour of the moment, or
    /// « #rrggbb ».
    pub aura: String,
    /// The user's music by name (« chill » → a Spotify playlist): « mets ma playlist chill ».
    pub links: Vec<VoiceLink>,
    /// « Seulement ma voix »: a sentence in another voice (the TV, a video, a friend) does not
    /// wake Kayro (voice/speaker.rs, from the calibration's recordings).
    pub only_me: bool,
    /// What the speakers play (music, a video, a game) is taken out of what the microphone
    /// hears (voice/echo.rs); useless with headphones.
    pub echo_cancel: bool,
    /// The brain (voice/brain/): once downloaded, it hears and understands the sentences on the
    /// graphics card; off, or missing, the classic way answers.
    pub brain: bool,
}

/// A piece of music the user named: a Spotify playlist, album, track, artist, show or episode.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct VoiceLink {
    pub name: String,
    /// « spotify:playlist:<22 letters and digits> » (Réglages turns a shared link into it).
    pub uri: String,
}

/// A Spotify address Kayro may open: « spotify:<kind>:<id> », nothing else (no other program, no
/// other site: a sentence never opens what the user did not name).
pub fn spotify_uri_ok(uri: &str) -> bool {
    let parts: Vec<&str> = uri.split(':').collect();
    matches!(parts.as_slice(), ["spotify", kind, id]
        if ["playlist", "album", "track", "artist", "show", "episode"].contains(kind)
            && id.len() == 22
            && id.bytes().all(|b| b.is_ascii_alphanumeric()))
}

/// At most this many named pieces of music.
pub const LINKS_MAX: usize = 50;

impl Default for VoiceSettings {
    fn default() -> Self {
        Self {
            mode: VoiceMode::Off,
            wake_word: WAKE_WORD_DEFAULT.into(),
            hotkey: VOICE_HOTKEY_DEFAULT.into(),
            model: VoiceModel::default(),
            in_game: false,
            wake_heard: Vec::new(),
            microphone: String::new(),
            speakers: String::new(),
            aura: String::new(),
            links: Vec::new(),
            only_me: false,
            echo_cancel: true,
            brain: true,
        }
    }
}

/// At most this many heard spellings are kept (the guided learning asks five, the calibration's
/// evaluation adds the ones it finds).
pub const WAKE_HEARD_MAX: usize = 12;

/// A few words of letters (accents too), spaces, apostrophes and hyphens.
fn words_only(w: &str, max: usize) -> bool {
    (2..=max).contains(&w.chars().count())
        && w.chars().any(char::is_alphabetic)
        && w.chars()
            .all(|c| c.is_alphabetic() || matches!(c, ' ' | '\'' | '’' | '-'))
}

impl VoiceSettings {
    pub fn wake_word_ok(&self) -> bool {
        words_only(self.wake_word.trim(), WAKE_WORD_MAX)
    }

    /// The heard spellings, the microphone id and the aura colour are plain and bounded.
    pub fn extras_ok(&self) -> bool {
        let hex = |s: &str| {
            s.len() == 7 && s.starts_with('#') && s[1..].bytes().all(|b| b.is_ascii_hexdigit())
        };
        self.wake_heard.len() <= WAKE_HEARD_MAX
            && self.wake_heard.iter().all(|h| words_only(h, 60))
            && self.microphone.len() <= 300
            && !self.microphone.chars().any(char::is_control)
            && self.speakers.len() <= 300
            && !self.speakers.chars().any(char::is_control)
            && (self.aura.is_empty() || hex(&self.aura))
            && self.links.len() <= LINKS_MAX
            && self
                .links
                .iter()
                .all(|l| words_only(l.name.trim(), WAKE_WORD_MAX) && spotify_uri_ok(&l.uri))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_spotify_addresses_are_music_links() {
        assert!(spotify_uri_ok("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"));
        assert!(spotify_uri_ok("spotify:album:4aawyAB9vmqN3uQ7FjRGTy"));
        for bad in [
            "spotify:playlist:short",
            "spotify:user:37i9dQZF1DXcBWIGoYBM5M",
            "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
            "cmd:/c:calc",
            "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M:extra",
        ] {
            assert!(!spotify_uri_ok(bad), "{bad}");
        }
    }

    #[test]
    fn wake_words_are_a_few_plain_words() {
        let with = |w: &str| VoiceSettings {
            wake_word: w.into(),
            ..Default::default()
        };
        assert!(with("Hé Kayro").wake_word_ok());
        assert!(with("Ok Jarvis").wake_word_ok());
        assert!(with("Dis-moi l'île").wake_word_ok());
        assert!(!with("").wake_word_ok());
        assert!(!with("a").wake_word_ok());
        assert!(!with("lance; rm -rf").wake_word_ok());
        assert!(!with(&"x".repeat(41)).wake_word_ok());
    }

    #[test]
    fn the_voice_round_trips_and_an_older_settings_file_reads_as_off() {
        let v = VoiceSettings {
            mode: VoiceMode::PushToTalk,
            ..Default::default()
        };
        let json = serde_json::to_string(&v).unwrap();
        assert!(json.contains(r#""mode":"pushToTalk""#));
        assert_eq!(serde_json::from_str::<VoiceSettings>(&json).unwrap(), v);
        use crate::config::schema::Settings;
        use crate::config::store::{lenient_merge, LoadReport};
        let mut file = serde_json::to_value(Settings::default()).unwrap();
        file.as_object_mut().unwrap().remove("voice");
        file["hotkey"] = "Ctrl+Alt+J".into();
        let old: Settings = lenient_merge(file, &mut LoadReport::default(), |_| Ok(()));
        assert_eq!(
            (old.hotkey.as_str(), &old.voice),
            ("Ctrl+Alt+J", &VoiceSettings::default())
        );

        // A voice written before `wakeHeard`, `microphone` and `aura` existed keeps its own values.
        let mut file = serde_json::to_value(Settings::default()).unwrap();
        file["voice"] = serde_json::json!({
            "mode": "always", "wakeWord": "Dis Yuna", "hotkey": "Ctrl+Alt+V",
            "model": "parakeet", "inGame": false
        });
        let mut report = LoadReport::default();
        let old: Settings = lenient_merge(file, &mut report, |_| Ok(()));
        assert_eq!(old.voice.mode, VoiceMode::Always);
        assert_eq!(old.voice.wake_word, "Dis Yuna");
        assert!(old.voice.wake_heard.is_empty() && old.voice.aura.is_empty());
        assert!(report.warnings.is_empty(), "{:?}", report.warnings);
    }
}
