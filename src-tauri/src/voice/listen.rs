//! The voice's listening thread (mod.rs says when it runs and when it parks). Always mode: the
//! microphone is read every 30 ms (ear.rs) and given to the ear (phrase.rs), which follows a
//! sentence until its end; then think.rs: the brain hears it, or the classic way writes it down
//! and looks for the wake word. What the next sentence may follow (follow.rs) keeps the aura lit.
//! Push-to-talk: the microphone opens while the shortcut is held, understood on release.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

use sherpa_onnx::{OnlineRecognizer, SpeakerEmbeddingExtractor, VoiceActivityDetector};
use tauri::{AppHandle, Runtime};
use tauri_specta::Event;

use super::brain::prompt::FollowUp;
use super::brain::slot::{Polled, Slot};
use super::calib::{self, VoiceRecorded};
use super::ear::Ear;
use super::echo::{Echo, Reference, OPTIONS};
use super::engine::{self, RATE};
use super::follow::{self, Follow};
use super::phrase::{Heard, Listener, Mode, OPEN_GATED};
use super::think;
use super::wake::Wake;
use super::{act, changed, now, set_state, talking, wait_change, wait_change_for, wait_talk};
use super::{VoiceSettings, VoiceStatus};
use crate::config::schema::{VoiceMode, VoiceModel};

const POLL: Duration = Duration::from_millis(30);
/// What the speakers played, kept while calibrating: as long as a saying can be.
const RECENT: usize = RATE as usize * 15;
const MAX_TALK: usize = RATE as usize * 15;
/// How often the always mode looks again: what is in front, a microphone gone, the brain.
const TICK: Duration = Duration::from_secs(2);
/// Without a microphone, how often one is looked for again (plugged in, freed by Windows).
const NO_MIC_RETRY: Duration = Duration::from_secs(5);

struct Models {
    model: VoiceModel,
    asr: engine::Command,
    /// The always mode's two: speech detection and the wake word's streaming model.
    listen: Option<(VoiceActivityDetector, OnlineRecognizer)>,
    /// Who speaks: for « Seulement ma voix » and the calibration (none if not downloaded).
    speaker: Option<SpeakerEmbeddingExtractor>,
    /// The brain's seat: loading on its own thread, there, or missing (brain/slot.rs).
    brain: Slot,
}

pub fn run<R: Runtime>(app: &AppHandle<R>) {
    let mut models: Option<Models> = None;
    loop {
        let n = now();
        if n.voice.mode == VoiceMode::Off {
            models = None;
            set_state(app, VoiceStatus::Off, None);
            wait_change(n.gen);
            continue;
        }
        if n.paused {
            // A game in full screen or the locked screen: the memory goes back to the PC (≈ 0.9 GB
            // with Parakeet, ≈ 5 GB of the card's with the brain) until it is over.
            models = None;
            set_state(app, VoiceStatus::Paused, None);
            wait_change(n.gen);
            continue;
        }
        if n.muted {
            set_state(app, VoiceStatus::Muted, None);
            wait_change(n.gen);
            continue;
        }
        let always = n.voice.mode == VoiceMode::Always;
        let speaker = always && (n.voice.only_me || calib::active());
        let wants = Wants {
            always,
            speaker,
            brain: think::brain_wanted(&n.voice, n.gaming),
        };
        if let Err(missing) = ensure(app, &mut models, n.voice.model, &wants) {
            tracing::info!(missing, "voice: a model is missing");
            if let Some(job) = calib::take_job() {
                let _ = job.send(Err(missing.clone()));
            }
            set_state(app, VoiceStatus::NoModel, Some(missing));
            wait_change(n.gen);
            continue;
        }
        let Some(m) = models.as_mut() else { continue };
        if let Some(job) = calib::take_job() {
            set_state(app, VoiceStatus::Thinking, None);
            let _ = job.send(evaluate(app, m, &n.voice));
            continue;
        }
        if always {
            listen(app, m, &n.voice, n.gen, wants.brain);
        } else {
            push_to_talk(app, m, &n.voice, n.gen);
        }
    }
}

/// What the voice needs beside the command model: the always mode's two listening models, who
/// speaks (« Seulement ma voix », the calibration), the brain.
struct Wants {
    always: bool,
    speaker: bool,
    brain: bool,
}

/// Loads what the mode needs (a few seconds), keeping what is already there. The brain loads on
/// its own thread: the voice listens meanwhile.
fn ensure<R: Runtime>(
    app: &AppHandle<R>,
    models: &mut Option<Models>,
    model: VoiceModel,
    wants: &Wants,
) -> Result<(), String> {
    let dir = engine::voice_dir();
    if models.as_ref().is_some_and(|m| m.model != model) {
        *models = None;
    }
    if models.is_none() {
        set_state(app, VoiceStatus::Loading, None);
        let asr = engine::command(&dir, model)?;
        *models = Some(Models {
            model,
            asr,
            listen: None,
            speaker: None,
            brain: Slot::default(),
        });
    }
    let Some(m) = models.as_mut() else {
        return Ok(());
    };
    if !wants.speaker {
        m.speaker = None;
    } else if m.speaker.is_none() {
        // Optional: without it every voice is heard (Réglages offers the download).
        m.speaker = engine::speaker(&dir).ok();
    }
    if !wants.always {
        m.listen = None;
    }
    if wants.brain {
        // Optional: without it, or until it is up, the classic way answers.
        m.brain.want(super::brain::dir());
    } else {
        m.brain.release();
    }
    if wants.always && m.listen.is_none() {
        set_state(app, VoiceStatus::Loading, None);
        m.listen = Some((engine::vad(&dir)?, engine::wake(&dir)?));
    }
    Ok(())
}

/// The always mode until something changes: a setting, the microphone gone, the brain due again
/// (run() then loads what is needed and comes back).
fn listen<R: Runtime>(
    app: &AppHandle<R>,
    m: &mut Models,
    voice: &VoiceSettings,
    gen: u64,
    brain_wanted: bool,
) {
    let wake = Wake::new(&voice.wake_word, &voice.wake_heard);
    let (Some((vad, model)), Some(wake)) = (m.listen.as_ref(), wake) else {
        return wait_change(gen);
    };
    let Some(mut ear) = Ear::open(&voice.microphone) else {
        set_state(app, VoiceStatus::NoMicrophone, None);
        return wait_change_for(gen, NO_MIC_RETRY);
    };
    // « Seulement ma voix »: the user's voiceprint, if the calibration made one.
    let print = if voice.only_me {
        super::speaker::load(&calib::dir())
    } else {
        None
    };
    let only = m.speaker.as_ref().zip(print.as_ref());
    // The speakers: their echo is taken out (voice/echo.rs); while calibrating, what they played
    // is kept beside each saying instead (the evaluation takes it out, with and without).
    let calibrating = calib::on();
    let with_speakers = voice.echo_cancel || calibrating;
    let mut speakers = with_speakers
        .then(|| Ear::speakers(&voice.speakers))
        .flatten();
    let mut echo = (voice.echo_cancel && !calibrating).then(|| Echo::new(OPTIONS));
    let mut reference = Reference::default();
    let (mut played, mut cleaned, mut heard) = (Vec::new(), Vec::new(), Vec::new());
    let mut recent: VecDeque<f32> = VecDeque::new();
    set_state(app, VoiceStatus::Waiting, None);
    let mut listener = Listener::new(vad, model, wake);
    listener.set_open(m.brain.get().is_some());
    // What the next sentence may follow, until when (follow.rs).
    let mut follow: Option<Follow> = None;
    let mut fresh = Vec::new();
    let mut tick_at = Instant::now();
    while !changed(gen) {
        std::thread::sleep(POLL);
        if tick_at.elapsed() >= TICK {
            tick_at = Instant::now();
            super::on_foreground(app);
            if ear.broken() || (brain_wanted && m.brain.due()) {
                return;
            }
            // The output device changed (headphones plugged in): its loopback is opened again.
            if with_speakers && speakers.as_ref().is_none_or(Ear::broken) {
                speakers = Ear::speakers(&voice.speakers);
            }
            // The brain finished loading: every sentence goes to it from now on.
            if m.brain.poll() == Polled::Ready {
                listener.set_open(true);
            }
        }
        fresh.clear();
        ear.hear(&mut fresh);
        if fresh.is_empty() {
            continue;
        }
        if let Some(s) = speakers.as_mut() {
            heard.clear();
            s.hear(&mut heard);
            reference.push(&heard);
            played.clear();
            reference.take(fresh.len(), &mut played);
            if calibrating {
                recent.extend(&played);
                let extra = recent.len().saturating_sub(RECENT);
                recent.drain(..extra);
            }
            if let Some(e) = echo.as_mut() {
                cleaned.clear();
                e.clean(&fresh, &played, &mut cleaned);
                std::mem::swap(&mut fresh, &mut cleaned);
            }
        }
        let mode = if calib::on() {
            Mode::Record
        } else if super::learning() {
            Mode::Learn
        } else {
            Mode::Command
        };
        if follow.as_ref().is_some_and(|f| f.expired(Instant::now())) {
            follow = None;
            set_state(app, VoiceStatus::Waiting, None);
        }
        let following = follow.is_some();
        listener.set_gated(OPEN_GATED && !following);
        match listener.push(&fresh, mode) {
            Heard::Nothing if following => {}
            Heard::Nothing => set_state(app, VoiceStatus::Waiting, None),
            Heard::Speaking if mode != Mode::Command => set_state(app, VoiceStatus::Hearing, None),
            Heard::Speaking => {}
            Heard::Woke => set_state(app, VoiceStatus::Hearing, None),
            Heard::Learned(text) => {
                super::learned(app, &text);
                set_state(app, VoiceStatus::Waiting, None);
            }
            Heard::Recorded(audio) => {
                // Between two prompts, what is said is not kept.
                let from = recent.len().saturating_sub(audio.len());
                let played: Vec<f32> = recent.range(from..).copied().collect();
                if let Some((key, ok)) = calib::save(&audio, &played) {
                    crate::ipc::notify(VoiceRecorded { key, ok }.emit(app));
                }
                set_state(app, VoiceStatus::Waiting, None);
            }
            Heard::Finished {
                audio,
                streamed,
                sure,
                ..
            } => {
                if let Some((x, print)) = only {
                    let (me, score) = super::speaker::is_me(x, print, &audio);
                    if !me {
                        // Another voice (the TV, a video, someone else): nothing is done, and
                        // an open window stays as it was.
                        tracing::info!(score, "voice: another voice, ignored");
                        listener.reset();
                        set_state(app, lit(following), None);
                        continue;
                    }
                }
                if sure || following {
                    set_state(app, VoiceStatus::Thinking, None);
                }
                let before = follow.take();
                let cx = think::Context {
                    follow_up: before.as_ref().map_or(FollowUp::None, |f| f.what.clone()),
                };
                let thought = m
                    .brain
                    .get()
                    .map(|b| think::with_brain(app, b, voice, &audio, cx));
                match thought {
                    Some(Ok(t)) => follow = follow::next(before, &t, Instant::now()),
                    other => {
                        if let Some(Err(e)) = other {
                            tracing::warn!(error = %e, "voice: the brain did not answer, classic way");
                        }
                        let wake = listener.wake();
                        think::classic(app, &m.asr, wake, voice, &audio, &streamed, sure);
                        if m.brain.stopped() {
                            // Crashed: the ear closes its open mode until the retry.
                            listener.set_open(false);
                        }
                    }
                }
                // What was heard while thinking is not a new sentence.
                ear.discard();
                listener.reset();
                set_state(app, lit(follow.is_some()), None);
            }
        }
    }
}

/// The aura after a sentence: softly lit while a window is open, else waiting for the wake word.
fn lit(following: bool) -> VoiceStatus {
    if following {
        VoiceStatus::Following
    } else {
        VoiceStatus::Waiting
    }
}

/// The user's recordings through the loaded models (« Calibrer ma voix »), with the brain if it
/// is there or still loading.
fn evaluate<R: Runtime>(
    app: &AppHandle<R>,
    m: &mut Models,
    voice: &VoiceSettings,
) -> Result<calib::CalibScore, String> {
    m.brain.wait();
    let Some((vad, stream)) = m.listen.as_ref() else {
        return Err("silero".into());
    };
    let (apps, scenes, links) = act::lists_of(app);
    let spoken = act::spoken_of(app);
    let lists = calib::Lists {
        apps: &apps,
        brain_apps: &spoken.apps,
        scenes: &scenes,
        links: &links,
    };
    let ears = calib::Ears {
        vad,
        stream,
        asr: &m.asr,
        speaker: m.speaker.as_ref(),
        brain: m.brain.get(),
    };
    calib::evaluate(ears, voice, &lists, &super::memory::recall, &calib::dir())
}

fn push_to_talk<R: Runtime>(app: &AppHandle<R>, m: &mut Models, voice: &VoiceSettings, gen: u64) {
    set_state(app, VoiceStatus::Ready, None);
    while wait_talk(gen) {
        if let Some(mut ear) = Ear::open(&voice.microphone) {
            set_state(app, VoiceStatus::Hearing, None);
            let mut audio = Vec::new();
            while talking() && !changed(gen) && audio.len() < MAX_TALK {
                std::thread::sleep(POLL);
                ear.hear(&mut audio);
            }
            ear.hear(&mut audio);
            drop(ear);
            if audio.len() >= RATE as usize * 3 / 10 {
                set_state(app, VoiceStatus::Thinking, None);
                m.brain.poll();
                think::held(app, m.brain.get(), &m.asr, voice, &audio);
            }
            set_state(app, VoiceStatus::Ready, None);
        } else {
            set_state(app, VoiceStatus::NoMicrophone, None);
        }
        // Held past the limit, or no microphone: wait for the release.
        while talking() && !changed(gen) {
            std::thread::sleep(POLL);
        }
    }
}
