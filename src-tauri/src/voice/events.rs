//! What the voice tells the page (step 21): where it stands (the microphone indicator), what a
//! command did, what the guided learning heard. Types only (mod.rs keeps the state).

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

use super::command::Music;
use crate::platform::audio::AppVolume;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum VoiceStatus {
    Off,
    /// The models are loading (a few seconds).
    Loading,
    /// Always mode: the microphone is open, waiting for the wake word.
    Waiting,
    /// Push-to-talk mode, the shortcut not held: the microphone is closed.
    Ready,
    /// Called (the wake word heard, the shortcut held, or a sentence may still follow the
    /// last one): the aura is lit, the command is being said.
    Hearing,
    /// The sentence is being understood (the brain, or written down the classic way).
    Thinking,
    /// A sentence may still follow the last one without the name (follow.rs): the aura stays
    /// lit, softer.
    Following,
    /// A program in full screen is in front, or the screen is locked: the microphone is closed.
    Paused,
    /// « Arrête d'écouter »: closed until the voice is turned on again.
    Muted,
    /// A model is missing (`missing` says which): to download in Réglages.
    NoModel,
    /// No microphone, or Windows refuses it (its privacy settings).
    NoMicrophone,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VoiceState {
    pub status: VoiceStatus,
    pub missing: Option<String>,
}

/// The microphone indicator follows this (the island, Réglages).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct VoiceStateChanged(pub VoiceState);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VoiceCandidate {
    pub id: String,
    pub name: String,
    pub scene: bool,
}

/// What a command did.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VoiceOutcome {
    Launched {
        id: String,
        name: String,
    },
    LaunchFailed {
        id: String,
        name: String,
    },
    SceneStarted {
        id: String,
        name: String,
    },
    /// « Ferme X »: asked to close at once, gently (its window may still ask to save).
    Closed {
        id: String,
        name: String,
    },
    /// « Ferme X » while X is not open.
    NotRunning {
        id: String,
        name: String,
    },
    /// The music: what was done to what plays (or Spotify started, for « mets la musique »).
    Music {
        action: Music,
    },
    /// The user's music, by name, opened in Spotify.
    MusicOpened {
        name: String,
    },
    /// Kysland's music mode turned on or off.
    MusicMode {
        on: bool,
    },
    /// The hands' camera turned on or off (step 22); `ok` false: the hands are not set up.
    Hands {
        on: bool,
        ok: bool,
    },
    ShowKayro,
    HideKayro,
    Search {
        query: String,
    },
    StoppedListening,
    /// Several sound alike: proposed, nothing started.
    Doubt {
        /// The words that named it (normalized): a choice teaches Kayro (memory.rs).
        said: String,
        candidates: Vec<VoiceCandidate>,
    },
    NotUnderstood,
    /// A window arranged (`what`: plein, reduire, restaurer, devant, gauche, droite, ecran,
    /// fermer); `ok` false: no such window, or not one of the user's apps (a close).
    Window {
        what: String,
        name: String,
        ok: bool,
    },
    VolumeTo {
        level: u8,
    },
    /// One app's sound; `ok` false: it plays nothing right now.
    AppVolume {
        name: String,
        what: AppVolume,
        ok: bool,
    },
    Mic {
        muted: bool,
        ok: bool,
    },
    /// Réglages opened on a page (the page opens it).
    Settings {
        page: String,
    },
    Theme {
        name: String,
        ok: bool,
    },
    Kysland {
        on: bool,
    },
    /// What plays (`title` empty: nothing).
    NowPlaying {
        title: String,
        artist: String,
    },
    Lock,
    Desktop,
    Files,
    Timer {
        minutes: u32,
    },
    /// The timer ended (Kayro comes to say so).
    TimerDone {
        minutes: u32,
    },
    Time {
        text: String,
    },
    Screenshot,
    WebSearch {
        query: String,
    },
    /// Typed into the window in front; `ok` false: a console, or no field (refused).
    Dictated {
        ok: bool,
    },
    /// Said to the assistant, but nothing Kayro can do yet.
    Unknown,
}

/// A command was heard: the sentence and what came of it (several things asked at once, with
/// the brain: the first, then the others, one note).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct VoiceHeard {
    pub text: String,
    pub outcome: VoiceOutcome,
    #[serde(default)]
    pub also: Vec<VoiceOutcome>,
}

/// The guided learning (« Apprendre mon mot d'éveil »): what the small model heard of one
/// saying of the wake word (its words before the command, if one was said too).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct VoiceLearned {
    pub heard: String,
}
