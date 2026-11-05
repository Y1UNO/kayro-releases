//! Windows' own voices (WinRT speech synthesis, OneCore): a few sentences said by each of them,
//! as 16-bit WAV in memory. Step 21: the calibration makes the « Seulement ma voix » threshold
//! sit between the user's voice and these impostors (voice/calib/impostors.rs). Nothing is
//! played, nothing leaves the PC.

use windows::core::HSTRING;
use windows::Media::SpeechSynthesis::{SpeechSynthesizer, VoiceInformation};
use windows::Storage::Streams::DataReader;

pub struct Voice {
    info: VoiceInformation,
    pub name: String,
    /// « fr-FR », « en-US »…
    pub language: String,
}

/// The voices installed (Hortense, Julie, Paul… and the English ones).
pub fn voices() -> Vec<Voice> {
    super::media::mta();
    let Ok(all) = SpeechSynthesizer::AllVoices() else {
        return Vec::new();
    };
    let n = all.Size().unwrap_or(0);
    (0..n)
        .filter_map(|i| all.GetAt(i).ok())
        .map(|info| Voice {
            name: info
                .DisplayName()
                .map(|s| s.to_string())
                .unwrap_or_default(),
            language: info.Language().map(|s| s.to_string()).unwrap_or_default(),
            info,
        })
        .collect()
}

/// `text` said by `voice`: mono samples (-1…1) and their rate (OneCore voices: 16 kHz).
pub fn say(voice: &Voice, text: &str) -> Option<(Vec<f32>, u32)> {
    let s = SpeechSynthesizer::new().ok()?;
    s.SetVoice(&voice.info).ok()?;
    let stream = s
        .SynthesizeTextToStreamAsync(&HSTRING::from(text))
        .ok()?
        .join()
        .ok()?;
    let size = u32::try_from(stream.Size().ok()?).ok()?;
    let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0).ok()?).ok()?;
    reader.LoadAsync(size).ok()?.join().ok()?;
    let mut bytes = vec![0u8; size as usize];
    reader.ReadBytes(&mut bytes).ok()?;
    wav_samples(&bytes)
}

/// A RIFF WAV (PCM 16-bit, or float 32-bit) as mono samples and its rate.
pub fn wav_samples(bytes: &[u8]) -> Option<(Vec<f32>, u32)> {
    if bytes.len() < 12 || &bytes[..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return None;
    }
    let (mut at, mut format) = (12, None);
    while at + 8 <= bytes.len() {
        let id = &bytes[at..at + 4];
        let len = u32::from_le_bytes(bytes[at + 4..at + 8].try_into().ok()?) as usize;
        let body = bytes.get(at + 8..(at + 8 + len).min(bytes.len()))?;
        if id == b"fmt " && body.len() >= 16 {
            let tag = u16::from_le_bytes([body[0], body[1]]);
            let channels = u16::from_le_bytes([body[2], body[3]]).max(1) as usize;
            let rate = u32::from_le_bytes(body[4..8].try_into().ok()?);
            let bits = u16::from_le_bytes([body[14], body[15]]);
            format = Some((tag, channels, rate, bits));
        } else if id == b"data" {
            let (tag, channels, rate, bits) = format?;
            let width = (bits / 8) as usize;
            if width == 0 {
                return None;
            }
            let frames = body.chunks_exact(width * channels).map(|f| {
                let sum: f32 = f
                    .chunks_exact(width)
                    .map(|s| match (tag, bits) {
                        (3, 32) => f32::from_le_bytes([s[0], s[1], s[2], s[3]]),
                        (_, 16) => f32::from(i16::from_le_bytes([s[0], s[1]])) / 32768.0,
                        _ => 0.0,
                    })
                    .sum();
                sum / channels as f32
            });
            return Some((frames.collect(), rate));
        }
        at += 8 + len + (len & 1);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_wav_in_memory_is_read_back() {
        let samples = [0.5f32, -0.25, 0.0, 1.0];
        let wav = crate::voice::engine::wav(&samples);
        let (got, rate) = wav_samples(&wav).unwrap();
        assert_eq!(rate, 16_000);
        assert_eq!(got.len(), 4);
        assert!((got[0] - 0.5).abs() < 1e-3 && (got[1] + 0.25).abs() < 1e-3);
        assert!(wav_samples(b"not a wav at all").is_none());
    }

    /// The voices of this PC: `cargo test -p hub voices_here -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn voices_here() {
        for v in voices() {
            let said = say(&v, "Bonjour, il fait beau aujourd'hui.");
            println!(
                "{} ({}): {:?}",
                v.name,
                v.language,
                said.map(|(s, r)| (s.len(), r))
            );
        }
    }
}
