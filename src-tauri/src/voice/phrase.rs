//! The always mode's ear, without the microphone: listen.rs feeds it what the microphone heard,
//! the tests feed it spoken files. While someone speaks, the small French model follows the
//! speech (with 1.2 s of sound from before: it needs a moment before the first syllable); once
//! the wake word is in what it heard, the sentence goes on until its end, then it is handed over
//! to be understood. Speech without the wake word is dropped at once — unless the ear is
//! « open » (the brain is there): every sentence up to `OPEN_LOOK` is handed over then, and the
//! brain judges whether it was said to the assistant. Time is counted in samples, so that a
//! file plays exactly as the microphone would.

use std::collections::VecDeque;
use std::time::Instant;

use sherpa_onnx::{OnlineRecognizer, OnlineStream, VoiceActivityDetector};

use super::engine::{self, RATE};
use super::wake::{self, Wake};

const PRE_ROLL: usize = RATE as usize * 6 / 5;
/// Speech without the wake word is dropped after this much (and as soon as it stops).
const MAX_UNWOKEN: usize = RATE as usize * 6;
const MAX_PHRASE: usize = RATE as usize * 12;
/// After the wake word alone, how long the command may take to come.
const COMMAND_WAIT: usize = RATE as usize * 5 / 2;
/// Half a second of silence brings the model's last syllables out.
const FLUSH: usize = RATE as usize / 2;
/// A sentence this short (with its 1.2 s before) that the small model did not wake on gets a
/// second look by the command model: a quick or mumbled wake word (« Yuna, ouvre Discord »
/// heard « DIX CORDE »).
const SECOND_LOOK: usize = RATE as usize * 5;
/// While calibrating, a saying ends after this much quiet (a pause between the wake word and the
/// command stays in it).
const RECORD_QUIET: usize = RATE as usize;

/// What the ear is listening for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// The wake word, then a command.
    Command,
    /// The guided learning: each saying is an example of the wake word.
    Learn,
    /// The calibration: each saying is kept whole (with its 1.2 s before).
    Record,
}

/// What a piece of sound changed.
#[derive(Debug, Clone, PartialEq)]
pub enum Heard {
    Nothing,
    /// Someone speaks (while learning: the indicator lights).
    Speaking,
    /// The wake word, sure, is in what was heard: the command is being said (the aura lights).
    Woke,
    /// While learning, a saying ended: what the small model heard of it.
    Learned(String),
    /// While calibrating, a saying ended: all of its sound.
    Recorded(Vec<f32>),
    /// A sentence that may be a command ended: its sound, the command as the small model heard
    /// it, whether that model was sure of the wake word (if not, the command model must find it
    /// at the start of what it writes: `second_look`), and whether it heard anything like it
    /// (sure or not: `hinted`).
    Finished {
        audio: Vec<f32>,
        streamed: String,
        sure: bool,
        hinted: bool,
    },
}

struct Phrase {
    stream: OnlineStream,
    audio: Vec<f32>,
    /// Where the command starts in the streaming text, once the wake word is in it, and how sure.
    woke: Option<(usize, wake::Heard)>,
    text: String,
    quiet: usize,
}

impl Phrase {
    fn feed(&mut self, model: &OnlineRecognizer, wake: &Wake, samples: &[f32]) {
        self.stream.accept_waveform(RATE, samples);
        self.audio.extend_from_slice(samples);
        while model.is_ready(&self.stream) {
            model.decode(&self.stream);
        }
        self.text = model
            .get_result(&self.stream)
            .map(|r| r.text)
            .unwrap_or_default();
        // Looked at again as the text grows: a « maybe » may become sure.
        if !matches!(self.woke, Some((_, wake::Heard::Sure))) {
            self.woke = wake.look(&self.text).or(self.woke);
        }
    }

    fn command(&self) -> &str {
        self.woke
            .map_or("", |(at, _)| self.text.get(at..).unwrap_or("").trim())
    }
}

pub struct Listener<'a> {
    vad: &'a VoiceActivityDetector,
    model: &'a OnlineRecognizer,
    wake: Wake,
    pre: VecDeque<f32>,
    phrase: Option<Phrase>,
    /// With the brain: every sentence up to `OPEN_LOOK` is handed over, the brain judges whether
    /// it was said to the assistant (the small model's wake word is only a hint then).
    open: bool,
    /// Open, but a sentence in which the small model heard nothing like the wake word is dropped
    /// (the brain is spared the room's chatter); listen.rs lifts it while a sentence may follow
    /// the last one without the name.
    gated: bool,
}

/// With the brain, a sentence this short is handed over whether the wake word was heard or not.
const OPEN_LOOK: usize = RATE as usize * 8;
/// With the brain, speech without the wake word is followed this long.
const OPEN_UNWOKEN: usize = RATE as usize * 9;
/// Whether the open ear is gated by default (measured on 2026-11-04: docs/ROADMAP.md › Voix).
pub const OPEN_GATED: bool = false;

impl<'a> Listener<'a> {
    pub fn new(vad: &'a VoiceActivityDetector, model: &'a OnlineRecognizer, wake: Wake) -> Self {
        vad.reset();
        Self {
            vad,
            model,
            wake,
            pre: VecDeque::with_capacity(PRE_ROLL * 2),
            phrase: None,
            open: false,
            gated: false,
        }
    }

    /// The brain is there (every short sentence goes to it) or not.
    pub fn set_open(&mut self, open: bool) {
        self.open = open;
    }

    /// Open: whether a sentence without a hint of the wake word is dropped.
    pub fn set_gated(&mut self, gated: bool) {
        self.gated = gated;
    }

    pub fn wake(&self) -> &Wake {
        &self.wake
    }

    /// After a sentence was handled: what was heard meanwhile is not a new one.
    pub fn reset(&mut self) {
        self.vad.reset();
        self.pre.clear();
        self.phrase = None;
    }

    pub fn push(&mut self, fresh: &[f32], mode: Mode) -> Heard {
        self.vad.accept_waveform(fresh);
        while self.vad.front().is_some() {
            self.vad.pop();
        }
        let speaking = self.vad.detected();
        let (model, wake) = (self.model, &self.wake);
        let Some(p) = self.phrase.as_mut() else {
            self.pre.extend(fresh);
            let extra = self.pre.len().saturating_sub(PRE_ROLL);
            self.pre.drain(..extra);
            if !speaking {
                return Heard::Nothing;
            }
            let mut p = Phrase {
                stream: model.create_stream(),
                audio: Vec::new(),
                woke: None,
                text: String::new(),
                quiet: 0,
            };
            p.feed(model, wake, &self.pre.drain(..).collect::<Vec<_>>());
            self.phrase = Some(p);
            return Heard::Speaking;
        };
        p.feed(model, wake, fresh);
        p.quiet = if speaking { 0 } else { p.quiet + fresh.len() };
        if mode == Mode::Record {
            if p.quiet < RECORD_QUIET && p.audio.len() <= MAX_PHRASE {
                return Heard::Speaking;
            }
            let audio = std::mem::take(&mut p.audio);
            self.phrase = None;
            return Heard::Recorded(audio);
        }
        if mode == Mode::Learn {
            if speaking {
                return Heard::Speaking;
            }
            p.feed(model, wake, &[0.0; FLUSH]);
            let heard = p.text.clone();
            self.phrase = None;
            return Heard::Learned(heard);
        }
        if p.woke.is_none() {
            if !speaking {
                p.feed(model, wake, &[0.0; FLUSH]);
            }
            if p.woke.is_none() {
                let (unwoken, look) = if self.open {
                    (OPEN_UNWOKEN, OPEN_LOOK)
                } else {
                    (MAX_UNWOKEN, SECOND_LOOK)
                };
                if speaking && p.audio.len() <= unwoken {
                    return Heard::Speaking;
                }
                let short = !speaking && p.audio.len() <= look && !(self.open && self.gated);
                let audio = std::mem::take(&mut p.audio);
                self.phrase = None;
                return if short {
                    Heard::Finished {
                        audio,
                        streamed: String::new(),
                        sure: false,
                        hinted: false,
                    }
                } else {
                    Heard::Nothing
                };
            }
        }
        let sure = matches!(p.woke, Some((_, wake::Heard::Sure)));
        // A verb alone (« Yuna lance… ») is not a command yet: what it starts may follow a breath.
        let said = !p.command().is_empty() && !bare_verb(p.command());
        if p.audio.len() > MAX_PHRASE || (!speaking && (said || p.quiet >= COMMAND_WAIT)) {
            let streamed = p.command().to_string();
            let audio = std::mem::take(&mut p.audio);
            self.phrase = None;
            return Heard::Finished {
                audio,
                streamed,
                sure,
                hinted: true,
            };
        }
        if sure {
            Heard::Woke
        } else {
            Heard::Speaking
        }
    }
}

/// One word, a command verb (« LANCE »): its object is still to come.
fn bare_verb(command: &str) -> bool {
    super::wake::words(command).len() == 1 && super::command::verb_start(command) == Some(0)
}

/// The command in what the command model wrote: after the wake word, else from its first command
/// verb (it may spell the wake word its own way), else what the small model heard.
pub fn command_of<'t>(wake: &Wake, written: &'t str, streamed: &'t str) -> &'t str {
    if let Some(at) = wake.find(written) {
        return again(wake, &written[at..]);
    }
    match super::command::verb_start(written) {
        Some(at) => &written[at..],
        None => streamed,
    }
}

/// The command model's look at a sentence the small model was not sure of: a command only when
/// it writes the wake word, sure, among its first two words (« Tu sais que Yuna arrive » is not).
pub fn second_look<'t>(wake: &Wake, written: &'t str) -> Option<&'t str> {
    wake.find_at_start(written, 2)
        .map(|at| again(wake, &written[at..]))
}

/// The wake word said again (« Yuna… dis Yuna, ferme Spotify », when the aura was slow to
/// light): the command is after the last one.
fn again<'t>(wake: &Wake, mut command: &'t str) -> &'t str {
    for _ in 0..2 {
        match wake.find_at_start(command, 2) {
            Some(at) => command = &command[at..],
            None => break,
        }
    }
    command
}

/// What a finished sentence asks, once the command model wrote it down: the command, or none.
pub fn command_in<'t>(
    wake: &Wake,
    written: &'t str,
    streamed: &'t str,
    sure: bool,
) -> Option<&'t str> {
    if sure {
        Some(command_of(wake, written, streamed))
    } else {
        second_look(wake, written)
    }
}

/// A spoken file (or a calibration saying) through the whole always mode.
#[derive(Debug, Default)]
pub struct Trial {
    /// The wake word was heard (the aura would have lit).
    pub woke: bool,
    /// What the command model wrote of the last sentence it was given.
    pub written: String,
    /// The command, if one was said (the first one).
    pub said: Option<String>,
    /// The command model's time on it.
    pub ms: u32,
}

/// The first sentence the ear cuts out of `samples` (1 s of quiet first, 3 s after, 30 ms at a
/// time), as the listening would hand it over, and whether the small model heard anything like
/// the wake word in it.
pub fn first_sentence(listener: &mut Listener, samples: &[f32]) -> Option<(Vec<f32>, bool)> {
    let mut sound = vec![0.0; RATE as usize];
    sound.extend_from_slice(samples);
    sound.extend(std::iter::repeat_n(0.0, RATE as usize * 3));
    let mut found = None;
    for chunk in sound.chunks(RATE as usize * 3 / 100) {
        if let Heard::Finished { audio, hinted, .. } = listener.push(chunk, Mode::Command) {
            found = Some((audio, hinted));
            break;
        }
    }
    listener.reset();
    found
}

/// `samples` as the microphone would give them: 1 s of quiet first, 3 s after, 30 ms at a time.
pub fn hear(listener: &mut Listener, asr: &engine::Command, hot: &str, samples: &[f32]) -> Trial {
    let mut sound = vec![0.0; RATE as usize];
    sound.extend_from_slice(samples);
    sound.extend(std::iter::repeat_n(0.0, RATE as usize * 3));
    let mut t = Trial::default();
    for chunk in sound.chunks(RATE as usize * 3 / 100) {
        match listener.push(chunk, Mode::Command) {
            Heard::Woke => t.woke = true,
            Heard::Finished {
                audio,
                streamed,
                sure,
                ..
            } => {
                let started = Instant::now();
                let text = asr.write(&audio, hot);
                t.ms = started.elapsed().as_millis() as u32;
                t.woke |= sure;
                let said = command_in(listener.wake(), &text, &streamed, sure).map(String::from);
                t.written = text;
                listener.reset();
                if said.is_some() {
                    t.woke = true;
                    t.said = said;
                    break;
                }
            }
            _ => {}
        }
    }
    listener.reset();
    t
}

#[cfg(test)]
#[path = "phrase_tests.rs"]
mod tests;
