//! Impostors for the voiceprint (« Seulement ma voix »): Windows' own voices (platform/tts.rs)
//! say a few sentences, as if a friend or the TV called the assistant; their embeddings put the
//! threshold between the user's own sayings and theirs (speaker.rs `build`). No one else is
//! needed, nothing is played.

use sherpa_onnx::{LinearResampler, SpeakerEmbeddingExtractor};

use crate::platform::tts;
use crate::voice::brain::prompt::name_of;
use crate::voice::engine::RATE;

/// Which voices make the cohort: all of them, or one language's (the harnesses hold the other
/// out, or leave them all out: `KAYRO_VOICE_IMPOSTORS=fr|en|0`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(not(test), allow(dead_code))]
pub enum Cohort {
    None,
    All,
    Language(&'static str),
}

/// What the harnesses ask for, else every voice.
pub fn cohort() -> Cohort {
    #[cfg(test)]
    if let Ok(v) = std::env::var("KAYRO_VOICE_IMPOSTORS") {
        return match v.as_str() {
            "0" => Cohort::None,
            "fr" => Cohort::Language("fr"),
            "en" => Cohort::Language("en"),
            _ => Cohort::All,
        };
    }
    Cohort::All
}

/// What each impostor says: the wake word and commands, as the user would.
fn sentences(wake_word: &str) -> [String; 3] {
    let name = name_of(wake_word);
    [
        format!("{wake_word}, ouvre Discord et monte le son."),
        "Tu as vu, il fait beau aujourd'hui, on sort ce soir ?".into(),
        format!("{name}, mets la musique et ferme Steam."),
    ]
}

/// The impostors' embeddings (one per sentence and voice), at 16 kHz.
pub fn embeddings(x: &SpeakerEmbeddingExtractor, wake_word: &str, who: Cohort) -> Vec<Vec<f32>> {
    let voices: Vec<tts::Voice> = match who {
        Cohort::None => return Vec::new(),
        Cohort::All => tts::voices(),
        Cohort::Language(l) => tts::voices()
            .into_iter()
            .filter(|v| v.language.starts_with(l))
            .collect(),
    };
    let mut out = Vec::new();
    for v in &voices {
        for text in sentences(wake_word) {
            let Some((samples, rate)) = tts::say(v, &text) else {
                continue;
            };
            let samples = if rate as i32 == RATE {
                samples
            } else {
                match LinearResampler::create(rate as i32, RATE) {
                    Some(r) => r.resample(&samples, true),
                    None => continue,
                }
            };
            if let Some(e) = crate::voice::speaker::embed(x, &samples) {
                out.push(e);
            }
        }
    }
    tracing::info!(
        voices = voices.len(),
        sayings = out.len(),
        "voice: impostors for the voiceprint"
    );
    out
}
