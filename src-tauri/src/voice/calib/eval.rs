//! The calibration's evaluation: every recording through the whole always mode, as the
//! microphone would give it. First what the small model hears of the user's wake word is learned
//! (a variant that would wake Kayro on a trap is never kept), then each saying is judged; with
//! the voice model, the user's voiceprint is made too (speaker.rs).

use std::path::Path;
use std::time::Instant;

use super::variants::variants;
use super::{load, store, CalibKind, CalibResult, CalibScore, Entry};
use crate::config::schema::VoiceSettings;
use crate::voice::command::{self, Intent, Named, Target};
use crate::voice::echo::{Echo, OPTIONS};
use crate::voice::engine::RATE;
use crate::voice::phrase::{self, Listener};
use crate::voice::wake::Wake;

/// An intent as the prompts name it (« app:<id> », « music:pause », « show »…).
pub fn key(intent: &Intent) -> String {
    match intent {
        Intent::Launch(Target::App(id)) => format!("app:{id}"),
        Intent::Launch(Target::Scene(id)) => format!("scene:{id}"),
        Intent::Close(id) => format!("close:{id}"),
        Intent::Music(m) => format!("music:{}", format!("{m:?}").to_lowercase()),
        Intent::MusicMode(on) => format!("musicmode:{}", if *on { "on" } else { "off" }),
        Intent::Link(uri) => format!("link:{uri}"),
        Intent::ShowKayro => "show".into(),
        Intent::HideKayro => "hide".into(),
        Intent::Search(_) => "search".into(),
        Intent::StopListening => "stop".into(),
        Intent::Doubt(_) => "doubt".into(),
        Intent::NotUnderstood => "unknown".into(),
        Intent::Window { app, what } => format!(
            "window:{}:{}",
            app.as_deref().unwrap_or("devant"),
            format!("{what:?}").to_lowercase().replace(['(', ')'], "")
        ),
        Intent::VolumeTo(n) => format!("volume:{n}"),
        Intent::AppVolume { app, what } => {
            format!("appvol:{app}:{}", format!("{what:?}").to_lowercase())
        }
        Intent::Mic(muted) => format!("mic:{}", if *muted { "off" } else { "on" }),
        Intent::LastGame => "lastgame".into(),
        Intent::Settings(page) => format!("settings:{page}"),
        Intent::Theme(id) => format!("theme:{id}"),
        Intent::Kysland(on) => format!("kysland:{}", if *on { "on" } else { "off" }),
        Intent::WhichSong => "whichsong".into(),
        Intent::Lock => "lock".into(),
        Intent::Desktop => "desktop".into(),
        Intent::Timer(n) => format!("timer:{n}"),
        Intent::Time => "time".into(),
        Intent::Screenshot => "screenshot".into(),
        Intent::WebSearch(_) => "web".into(),
        Intent::Dictate(_) => "dictate".into(),
        Intent::Unknown => "inconnu".into(),
    }
}

pub struct Lists<'a> {
    pub apps: &'a [Named],
    /// The apps as the brain is told them (one per app, with what it is: brain/apps.rs).
    pub brain_apps: &'a [Named],
    pub scenes: &'a [Named],
    pub links: &'a [Named],
}

impl Lists<'_> {
    /// A recording about an app, a scene or a piece of music removed since: not counted.
    fn has(&self, expect: &str) -> bool {
        let among = |list: &[Named], id: &str| list.iter().any(|n| n.id == id);
        match expect.split_once(':') {
            Some(("app" | "close", id)) => among(self.apps, id),
            Some(("scene", id)) => among(self.scenes, id),
            Some(("link", id)) => among(self.links, id),
            _ => true,
        }
    }
}

pub struct Ears<'a> {
    pub vad: &'a sherpa_onnx::VoiceActivityDetector,
    pub stream: &'a sherpa_onnx::OnlineRecognizer,
    pub asr: &'a crate::voice::engine::Command,
    /// With it, the user's voiceprint is made (speaker.rs).
    pub speaker: Option<&'a sherpa_onnx::SpeakerEmbeddingExtractor>,
    /// With it, each sentence is judged by the brain, as the listening does (brain/).
    pub brain: Option<&'a crate::voice::brain::Brain>,
}

/// One saying through the listening: whether the assistant was called, what was written (or the
/// brain's lines), what came of it (an intent's `key`, « none »), and the time it took.
struct Heard {
    woke: bool,
    written: String,
    got: String,
    ms: u32,
}

/// The brain's way: the ear cuts the sentence out (open, as live), the brain judges it.
fn by_brain(
    brain: &crate::voice::brain::Brain,
    world: &crate::voice::brain::prompt::World,
    listener: &mut Listener,
    samples: &[f32],
) -> Heard {
    use crate::voice::brain::prompt;
    listener.set_gated(gated());
    let Some((audio, _)) = phrase::first_sentence(listener, samples) else {
        // The ear cut no sentence out of it (too long, or nothing like speech).
        return Heard {
            woke: false,
            written: "(aucune phrase)".into(),
            got: "none".into(),
            ms: 0,
        };
    };
    let started = Instant::now();
    let system = prompt::system(world);
    let text = brain
        .ask(&system, &prompt::grammar(world), &audio, None)
        .unwrap_or_else(|e| format!("(erreur : {e})"));
    let answer = prompt::answer(&text, world);
    let ms = started.elapsed().as_millis() as u32;
    let got = match (answer.called, answer.actions.first()) {
        (false, _) => "none".to_string(),
        (true, Some(a)) => key(&a.intent),
        (true, None) => "unknown".to_string(),
    };
    Heard {
        woke: answer.called,
        written: text.replace('\n', " / "),
        got,
        ms,
    }
}

/// How the voiceprint scores a sentence (the harnesses measure both: `KAYRO_VOICE_PRINT=mean|top3`).
fn method() -> crate::voice::speaker::Method {
    #[cfg(test)]
    if let Ok(v) = std::env::var("KAYRO_VOICE_PRINT") {
        return match v.as_str() {
            "top3" => crate::voice::speaker::Method::Top3,
            _ => crate::voice::speaker::Method::Mean,
        };
    }
    crate::voice::speaker::METHOD
}

/// Whether the open ear drops sentences without a hint of the wake word, as the listening does
/// (the harnesses measure both: `KAYRO_VOICE_GATE=0|1`).
fn gated() -> bool {
    #[cfg(test)]
    if let Ok(v) = std::env::var("KAYRO_VOICE_GATE") {
        return v == "1";
    }
    phrase::OPEN_GATED
}

/// A recording and its sound.
pub(super) struct Said<'e> {
    pub(super) entry: &'e Entry,
    pub(super) samples: Vec<f32>,
}

/// A saying with the speakers' echo taken out, as the listening does it (but from cold: the
/// canceller has only the saying's own 1.2 s before to settle, a little worse than live).
fn without_echo(samples: &[f32], played: &[f32]) -> Vec<f32> {
    let mut e = Echo::new(OPTIONS);
    let mut out = Vec::with_capacity(samples.len());
    let step = RATE as usize * 3 / 100;
    for (m, p) in samples.chunks(step).zip(played.chunks(step)) {
        e.clean(m, p, &mut out);
    }
    // Past the end of what the speakers played: as heard.
    out.extend_from_slice(&samples[played.len().min(samples.len())..]);
    out
}

/// Every recording through the whole always mode, as the microphone would give it, once what
/// the small model hears of the user's wake word is learned (`CalibScore::learned`); with the
/// voice model, the user's voiceprint too.
pub fn evaluate(
    ears: Ears,
    voice: &VoiceSettings,
    lists: &Lists,
    recall: &dyn Fn(&str) -> Option<Target>,
    from: &Path,
) -> Result<CalibScore, String> {
    let started = Instant::now();
    let mut m = load(from);
    let said: Vec<Said> = m
        .entries
        .iter()
        .filter(|e| lists.has(&e.expect))
        .filter_map(|entry| {
            let path = from.join(format!("{}.wav", entry.key));
            let wave = sherpa_onnx::Wave::read(&path.to_string_lossy())?;
            if wave.sample_rate() != RATE {
                return None;
            }
            let played = voice
                .echo_cancel
                .then(|| super::reference_of(from, &entry.key))
                .and_then(|p| sherpa_onnx::Wave::read(&p.to_string_lossy()));
            let samples = match played {
                Some(p) => without_echo(wave.samples(), p.samples()),
                None => wave.samples().to_vec(),
            };
            Some(Said { entry, samples })
        })
        .collect();
    if said.is_empty() {
        return Err("no recording".into());
    }
    let hot = command::hotwords(&voice.wake_word, lists.apps, lists.scenes, lists.links);
    #[cfg(test)]
    let hot = super::variants::experiment(hot);
    let learned = variants(&ears, voice, &hot, &said);
    let wake = Wake::new(&voice.wake_word, &learned).ok_or("wake word")?;
    let mut listener = Listener::new(ears.vad, ears.stream, wake);
    listener.set_open(ears.brain.is_some());
    let world = crate::voice::brain::prompt::World {
        wake_word: &voice.wake_word,
        apps: lists.brain_apps,
        scenes: lists.scenes,
        links: lists.links,
        themes: &[],
        screens: crate::platform::screens::screens().len(),
    };
    let (mut clean, mut noisy) = (Vec::new(), Vec::new());
    let mut s = CalibScore {
        learned,
        ..Default::default()
    };
    let mut times = Vec::new();
    for Said { entry: e, samples } in &said {
        if let Some(print) = ears
            .speaker
            .and_then(|x| crate::voice::speaker::embed(x, samples))
        {
            if e.kind == CalibKind::Music {
                noisy.push(print);
            } else {
                clean.push(print);
            }
        }
        let t = match ears.brain {
            Some(brain) => by_brain(brain, &world, &mut listener, samples),
            None => {
                let t = phrase::hear(&mut listener, ears.asr, &hot, samples);
                let got = t.said.as_deref().map_or_else(
                    || "none".to_string(),
                    |said| {
                        let p = command::parse_with(
                            said,
                            lists.apps,
                            lists.scenes,
                            lists.links,
                            recall,
                        );
                        key(&p.intent)
                    },
                );
                Heard {
                    woke: t.woke,
                    written: t.written,
                    got,
                    ms: t.ms,
                }
            }
        };
        let got = t.got;
        use CalibKind::*;
        let right = match e.kind {
            Wake | Name => t.woke,
            Command | Quick | Music => got == e.expect,
            Trap | Chat => got == "none",
        };
        match e.kind {
            Wake | Name => s.wake.add(right),
            Command | Quick => {
                s.wake.add(t.woke);
                s.commands.add(right);
            }
            Music => {
                s.wake.add(t.woke);
                s.music.add(right);
            }
            Trap | Chat => s.calm.add(right),
        }
        if t.ms > 0 {
            times.push(t.ms);
        }
        s.results.push(CalibResult {
            key: e.key.clone(),
            kind: e.kind,
            text: e.text.clone(),
            heard: t.written,
            got,
            woke: t.woke,
            right,
        });
    }
    times.sort_unstable();
    s.median_ms = times.get(times.len() / 2).copied().unwrap_or(0);
    // Other voices (Windows' own) keep the threshold away from them.
    let impostors = ears
        .speaker
        .map(|x| super::impostors::embeddings(x, &voice.wake_word, super::impostors::cohort()))
        .unwrap_or_default();
    let built = crate::voice::speaker::build(&clean, &noisy, &impostors, method());
    if let Some((print, ratio)) = built {
        s.voice = ratio;
        if let Err(e) = crate::voice::speaker::store(from, &print) {
            tracing::warn!(error = %e, "voice: the voiceprint was not kept");
        }
    }
    tracing::info!(
        recordings = s.results.len(),
        wake = ?s.wake,
        commands = ?s.commands,
        music = ?s.music,
        calm = ?s.calm,
        voice = ?s.voice,
        learned = s.learned.len(),
        median_ms = s.median_ms,
        took_ms = started.elapsed().as_millis() as u64,
        "voice: calibration evaluated"
    );
    m.score = serde_json::to_value(&s).ok();
    if let Err(e) = store(from, &m) {
        tracing::warn!(error = %e, "voice: the calibration score was not kept");
    }
    Ok(s)
}
