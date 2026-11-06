//! What the small model hears of the user's wake word, learned from the calibration's recordings
//! (eval.rs runs it first): spellings it does not take for the wake word yet (« DIOU NA »,
//! « YOUNE »), never one that would wake Kayro on a trap or free speech.

use super::eval::{Ears, Said};
use super::CalibKind;
use crate::config::schema::VoiceSettings;
use crate::voice::command;
use crate::voice::engine::RATE;
use crate::voice::phrase::{self, Listener};
use crate::voice::wake::Wake;

/// The small model's text of a saying (the guided learning's look).
fn streamed(listener: &mut Listener, samples: &[f32]) -> String {
    let mut sound = vec![0.0; RATE as usize];
    sound.extend_from_slice(samples);
    sound.extend(std::iter::repeat_n(0.0, RATE as usize * 2));
    let mut text = String::new();
    for chunk in sound.chunks(RATE as usize * 3 / 100) {
        if let phrase::Heard::Learned(t) = listener.push(chunk, phrase::Mode::Learn) {
            text = t;
            break;
        }
    }
    listener.reset();
    text
}

/// The words of a saying before its command (`prompt`: what was asked, « Dis Yuna, ouvre
/// Discord »): never a word of the command itself, at most one more word than the wake word.
fn wake_words(text: &str, prompt: &str, wake_word: &str) -> String {
    let said: Vec<String> = command::normalize(prompt)
        .split_whitespace()
        .skip(crate::voice::wake::words(wake_word).len())
        .map(String::from)
        .collect();
    let most = crate::voice::wake::words(wake_word).len() + 1;
    command::wake_part(text)
        .split_whitespace()
        .take_while(|w| !said.contains(&command::normalize(w)))
        .take(most)
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}

fn has_wake_word(kind: CalibKind) -> bool {
    matches!(
        kind,
        CalibKind::Wake | CalibKind::Name | CalibKind::Command | CalibKind::Quick
    )
}

/// The spellings to keep: most heard first, after the ones already learned (they go through
/// the same checks: one of them may wake on a trap).
pub(super) fn variants(
    ears: &Ears,
    voice: &VoiceSettings,
    hot: &str,
    said: &[Said],
) -> Vec<String> {
    let Some(known) = Wake::new(&voice.wake_word, &voice.wake_heard) else {
        return voice.wake_heard.clone();
    };
    let mut listener = Listener::new(ears.vad, ears.stream, known.clone());
    let mut heard: Vec<(String, usize)> = Vec::new();
    let mut calm: Vec<String> = Vec::new();
    for s in said {
        let text = streamed(&mut listener, &s.samples);
        if has_wake_word(s.entry.kind) {
            // What each model wrote of the wake word, when it did not take it for it.
            let written = ears.asr.write(&s.samples, hot);
            for text in [text, written] {
                let part = wake_words(&text, &s.entry.text, &voice.wake_word);
                if part.chars().filter(|c| c.is_alphabetic()).count() >= 2
                    && known.find(&text.to_uppercase()).is_none()
                {
                    match heard.iter_mut().find(|(h, _)| *h == part) {
                        Some((_, n)) => *n += 1,
                        None => heard.push((part, 1)),
                    }
                }
            }
        } else if matches!(s.entry.kind, CalibKind::Trap | CalibKind::Chat) {
            calm.push(text);
            calm.push(ears.asr.write(&s.samples, hot));
        }
    }
    heard.sort_by_key(|h| std::cmp::Reverse(h.1));
    let mut kept = Vec::new();
    let before = voice.wake_heard.iter().map(|h| (h.clone(), 0));
    for (h, _) in before.chain(heard) {
        if !crate::voice::wake::learned_ok(&h, &voice.wake_word) {
            continue;
        }
        if kept.len() >= crate::config::voice::WAKE_HEARD_MAX {
            break;
        }
        let Some(with) = Wake::new(&voice.wake_word, std::slice::from_ref(&h)) else {
            continue;
        };
        let wakes_a_trap = calm.iter().any(|t| with.find(&t.to_uppercase()).is_some());
        if !wakes_a_trap && !kept.contains(&h) {
            kept.push(h);
        }
    }
    kept
}

/// Hotword strategies to measure on a user's recordings (`KAYRO_VOICE_HOT`: none, core, low<score>;
/// 2026-11-04: the user's apps at 0.5 were best).
#[cfg(test)]
pub(super) fn experiment(hot: String) -> String {
    let Ok(how) = std::env::var("KAYRO_VOICE_HOT") else {
        return hot;
    };
    let lines: Vec<&str> = hot.lines().collect();
    let core = |l: &str| {
        l.ends_with(":3") || l.chars().next().is_some_and(char::is_lowercase) || l == "Kayro"
    };
    match how.as_str() {
        "none" => String::new(),
        "core" => lines
            .iter()
            .filter(|l| core(l))
            .copied()
            .collect::<Vec<_>>()
            .join("\n"),
        w if w.starts_with("low") => {
            let score = w.trim_start_matches("low");
            lines
                .iter()
                .map(|l| {
                    if core(l) {
                        l.to_string()
                    } else {
                        format!("{l} :{score}")
                    }
                })
                .collect::<Vec<_>>()
                .join("\n")
        }
        _ => hot,
    }
}
