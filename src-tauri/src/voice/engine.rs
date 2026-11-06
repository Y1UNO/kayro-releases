//! The voice's models (sherpa-onnx, all on the PC): Silero for « someone speaks », the small
//! French streaming model for the wake word, and Parakeet or Canary for the command. They sit in
//! `%APPDATA%/Kayro/voice/`, one folder each as their archives unpack (downloaded on demand
//! from Réglages; never in the installer). Measured on 2026-11-04 (docs/ROADMAP.md › Voix).

use std::path::{Path, PathBuf};

use sherpa_onnx::{
    OfflineCanaryModelConfig, OfflineRecognizer, OfflineRecognizerConfig,
    OfflineTransducerModelConfig, OnlineRecognizer, OnlineRecognizerConfig, SileroVadModelConfig,
    SpeakerEmbeddingExtractor, SpeakerEmbeddingExtractorConfig, VadModelConfig,
    VoiceActivityDetector,
};

use crate::config::schema::VoiceModel;

/// The sample rate every model takes.
pub const RATE: i32 = 16_000;

pub const VAD_FILE: &str = "silero_vad.onnx";
pub const WAKE_DIR: &str = "sherpa-onnx-streaming-zipformer-fr-2023-04-14";
const WAKE_FILES: &str = "epoch-29-avg-9-with-averaged-model";
pub const PARAKEET_DIR: &str = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8";
pub const CANARY_DIR: &str = "sherpa-onnx-nemo-canary-180m-flash-en-es-de-fr-int8";
/// Who speaks: CAM++ (3D-Speaker), trained on Chinese and English voices of every kind; on six
/// voices (2026-11-04) it told them apart best of five models, 9 ms per second of speech.
pub const SPEAKER_FILE: &str = "3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx";

pub fn voice_dir() -> PathBuf {
    crate::paths::data_dir().join("voice")
}

/// A file of a model, or the name of the model that lacks it.
fn need(dir: &Path, name: &str, model: &str) -> Result<Option<String>, String> {
    let path = dir.join(name);
    if path.is_file() {
        Ok(Some(path.to_string_lossy().into_owned()))
    } else {
        Err(model.to_string())
    }
}

/// Is a person speaking? Silero, one thread (0.4 % of a core, 28 MB).
pub fn vad(dir: &Path) -> Result<VoiceActivityDetector, String> {
    let mut c = VadModelConfig {
        sample_rate: RATE,
        num_threads: 1,
        ..Default::default()
    };
    c.silero_vad = SileroVadModelConfig {
        model: need(dir, VAD_FILE, "silero")?,
        threshold: 0.5,
        min_silence_duration: 0.3,
        min_speech_duration: 0.2,
        window_size: 512,
        max_speech_duration: 12.0,
    };
    VoiceActivityDetector::create(&c, 20.0).ok_or_else(|| "silero".to_string())
}

/// Who speaks (« Seulement ma voix »): one thread, ≈ 30 ms a sentence.
pub fn speaker(dir: &Path) -> Result<SpeakerEmbeddingExtractor, String> {
    let c = SpeakerEmbeddingExtractorConfig {
        model: need(dir, SPEAKER_FILE, "speaker")?,
        num_threads: 1,
        ..Default::default()
    };
    SpeakerEmbeddingExtractor::create(&c).ok_or_else(|| "speaker".to_string())
}

/// The small French streaming model that listens for the wake word while someone speaks (one
/// thread: 6 % of a core while speaking, 191 MB).
pub fn wake(dir: &Path) -> Result<OnlineRecognizer, String> {
    let d = dir.join(WAKE_DIR);
    let mut c = OnlineRecognizerConfig::default();
    let t = &mut c.model_config.transducer;
    t.encoder = need(&d, &format!("encoder-{WAKE_FILES}.int8.onnx"), "wake")?;
    t.decoder = need(&d, &format!("decoder-{WAKE_FILES}.int8.onnx"), "wake")?;
    t.joiner = need(&d, &format!("joiner-{WAKE_FILES}.int8.onnx"), "wake")?;
    c.model_config.tokens = need(&d, "tokens.txt", "wake")?;
    c.model_config.num_threads = 1;
    OnlineRecognizer::create(&c).ok_or_else(|| "wake".to_string())
}

/// Parakeet's pieces with their order as score (sentencepiece BPE: an earlier piece merges first),
/// written once beside its tokens: what the hotwords are cut into.
fn pieces_vocab(d: &Path) -> Result<String, String> {
    let vocab = d.join("bpe.vocab");
    if !vocab.is_file() {
        let tokens = std::fs::read_to_string(d.join("tokens.txt")).map_err(|e| e.to_string())?;
        let lines: Vec<String> = tokens
            .lines()
            .filter_map(|l| l.rsplit_once(' '))
            .map(|(piece, id)| format!("{piece}	-{id}"))
            .collect();
        std::fs::write(
            &vocab,
            lines.join(
                "
",
            ),
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(vocab.to_string_lossy().into_owned())
}

/// The model that writes the command down (4 threads: ~0.2-0.4 s for a short sentence). Parakeet
/// leans toward the user's own words (hotwords, given with each sentence: the wake word, the apps,
/// the scenes, the commands): « Dis Yuna » written « Di Une » before, right after (2026-11-04,
/// measured on spoken files, for 10-20 % more time).
pub fn command(dir: &Path, model: VoiceModel) -> Result<Command, String> {
    let mut c = OfflineRecognizerConfig::default();
    match model {
        VoiceModel::Parakeet => {
            let d = dir.join(PARAKEET_DIR);
            c.model_config.transducer = OfflineTransducerModelConfig {
                encoder: need(&d, "encoder.int8.onnx", "parakeet")?,
                decoder: need(&d, "decoder.int8.onnx", "parakeet")?,
                joiner: need(&d, "joiner.int8.onnx", "parakeet")?,
            };
            c.model_config.tokens = need(&d, "tokens.txt", "parakeet")?;
            c.model_config.model_type = Some("nemo_transducer".into());
            c.model_config.modeling_unit = Some("bpe".into());
            c.model_config.bpe_vocab = Some(pieces_vocab(&d).map_err(|_| "parakeet".to_string())?);
            c.decoding_method = Some("modified_beam_search".into());
            c.max_active_paths = 4;
            c.hotwords_score = 2.0;
        }
        VoiceModel::Canary => {
            let d = dir.join(CANARY_DIR);
            c.model_config.canary = OfflineCanaryModelConfig {
                encoder: need(&d, "encoder.int8.onnx", "canary")?,
                decoder: need(&d, "decoder.int8.onnx", "canary")?,
                src_lang: Some("fr".into()),
                tgt_lang: Some("fr".into()),
                use_pnc: true,
            };
            c.model_config.tokens = need(&d, "tokens.txt", "canary")?;
        }
    }
    c.model_config.num_threads = 4;
    let rec = OfflineRecognizer::create(&c).ok_or_else(|| format!("{model:?}").to_lowercase())?;
    Ok(Command {
        rec,
        hotwords: model == VoiceModel::Parakeet,
    })
}

/// The model that writes the command down, and whether it takes hotwords (Parakeet does;
/// Canary, given some, stopped the whole program: found on 2026-11-04).
pub struct Command {
    rec: OfflineRecognizer,
    hotwords: bool,
}

impl Command {
    /// What `samples` (16 kHz) say, leaning toward `hotwords` when the model takes them (one per
    /// line, « :3 » after one leans more, « :0.5 » less).
    pub fn write(&self, samples: &[f32], hotwords: &str) -> String {
        let stream = if self.hotwords && !hotwords.is_empty() {
            self.rec.create_stream_with_hotwords(hotwords)
        } else {
            self.rec.create_stream()
        };
        stream.accept_waveform(RATE, samples);
        self.rec.decode(&stream);
        stream.get_result().map(|r| r.text).unwrap_or_default()
    }
}

/// A WAV file of `samples`: 16-bit PCM, mono, 16 kHz (the calibration's sayings, the brain's
/// sentences).
pub fn wav(samples: &[f32]) -> Vec<u8> {
    let data = (samples.len() * 2) as u32;
    let mut b = Vec::with_capacity(44 + data as usize);
    b.extend_from_slice(b"RIFF");
    b.extend_from_slice(&(36 + data).to_le_bytes());
    b.extend_from_slice(b"WAVEfmt ");
    b.extend_from_slice(&16u32.to_le_bytes());
    b.extend_from_slice(&1u16.to_le_bytes());
    b.extend_from_slice(&1u16.to_le_bytes());
    b.extend_from_slice(&(RATE as u32).to_le_bytes());
    b.extend_from_slice(&(RATE as u32 * 2).to_le_bytes());
    b.extend_from_slice(&2u16.to_le_bytes());
    b.extend_from_slice(&16u16.to_le_bytes());
    b.extend_from_slice(b"data");
    b.extend_from_slice(&data.to_le_bytes());
    for s in samples {
        b.extend_from_slice(&((s.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
    }
    b
}
