//! What a finished sentence becomes. With the brain (brain/), the sentence itself goes to it: it
//! says whether the assistant was called and what was asked (several things, a screen), bound to
//! the user's own apps; without it, or when it fails, the classic way: Parakeet writes it down,
//! the wake word is looked for, the rules read the command (command.rs).

use std::time::Instant;

use tauri::{AppHandle, Manager, Runtime};

use super::brain::prompt::{self, Context as Seen, FollowUp, Front, World};
use super::brain::Brain;
use super::phrase::command_in;
use super::wake::Wake;
use super::{act, engine};
use crate::config::schema::VoiceSettings;

/// How the brain's answer went.
pub enum Thought {
    /// Not said to the assistant: nothing done.
    NotCalled,
    /// Called, and what was asked is done (`done`: the brain's lines for it, what a next sentence
    /// may follow; nothing asked: the next sentence is listened to as its follow-up).
    Done { asked: usize, done: String },
}

/// What is known of a sentence besides its sound.
pub struct Context {
    /// What it follows (« Arya… » then « ouvre Discord »; « change la musique » then « en fait,
    /// reviens à la précédente »), or the shortcut was held.
    pub follow_up: FollowUp,
}

/// The sentence `audio` to the brain. `Err`: no answer (the classic way takes over).
pub fn with_brain<R: Runtime>(
    app: &AppHandle<R>,
    brain: &Brain,
    voice: &VoiceSettings,
    audio: &[f32],
    cx: Context,
) -> Result<Thought, String> {
    let (_, scenes, links) = act::lists_of(app);
    let spoken = act::spoken_of(app);
    let themes = act::themes_of(app);
    let screens = crate::platform::screens::screens().len();
    let world = World {
        wake_word: &voice.wake_word,
        apps: &spoken.apps,
        scenes: &scenes,
        links: &links,
        themes: &themes,
        screens,
    };
    let hint = prompt::hint(&cx.follow_up, &voice.wake_word, &seen(app, &spoken));
    let started = Instant::now();
    let system = prompt::system(&world);
    let text = brain.ask(&system, &prompt::grammar(&world), audio, hint.as_deref())?;
    let answer = prompt::answer_after(&text, &world, &cx.follow_up);
    // Where the voice stands and how long it took, never what was said.
    tracing::info!(
        called = answer.called,
        asked = answer.actions.len(),
        following = cx.follow_up != FollowUp::None,
        ms = started.elapsed().as_millis() as u64,
        "voice: the brain answered"
    );
    if !answer.called {
        return Ok(Thought::NotCalled);
    }
    let asked = answer.actions.len();
    act::run(app, answer.actions);
    Ok(Thought::Done {
        asked,
        done: prompt::done_lines(&text),
    })
}

/// The classic way: Parakeet writes it down, then the wake word and the rules (a command found
/// is done).
pub fn classic<R: Runtime>(
    app: &AppHandle<R>,
    asr: &engine::Command,
    wake: &Wake,
    voice: &VoiceSettings,
    audio: &[f32],
    streamed: &str,
    sure: bool,
) {
    let hot = act::hotwords(app, &voice.wake_word);
    let text = asr.write(audio, &hot);
    if let Some(said) = command_in(wake, &text, streamed, sure) {
        act::command(app, &text, said);
    }
}

/// Push-to-talk: the shortcut was held, so the sentence is the user's command (brain first).
pub fn held<R: Runtime>(
    app: &AppHandle<R>,
    brain: Option<&Brain>,
    asr: &engine::Command,
    voice: &VoiceSettings,
    audio: &[f32],
) {
    if let Some(b) = brain {
        let cx = Context {
            follow_up: FollowUp::Called,
        };
        match with_brain(app, b, voice, audio, cx) {
            Ok(_) => return,
            Err(e) => tracing::warn!(error = %e, "voice: the brain did not answer, classic way"),
        }
    }
    let text = asr.write(audio, &act::hotwords(app, ""));
    act::command(app, &text, &text);
}

/// What is in front of the user right now (told to the brain, never kept): the window in front
/// (one of the user's apps, else its program and title) and the user's apps running, by the ids
/// the brain knows them by (`spoken`).
pub fn seen<R: Runtime>(app: &AppHandle<R>, spoken: &super::brain::apps::Spoken) -> Seen {
    use crate::procwatch::ProcWatch;
    let watch = app.state::<ProcWatch>();
    let running = watch.apps_running();
    let told = |id: &str| spoken.represent(id).unwrap_or(id).to_string();
    let mut open: Vec<String> = running
        .iter()
        .filter(|a| a.running)
        .map(|a| told(&a.id))
        .collect();
    open.sort();
    open.dedup();
    let front = crate::platform::arrange::front(std::process::id()).map(|(hwnd, pid)| Front {
        app: running
            .iter()
            .find(|a| a.foreground && a.running)
            .map(|a| told(&a.id)),
        exe: crate::platform::process::exe_name(pid).unwrap_or_default(),
        title: crate::platform::arrange::title(hwnd),
        screen: crate::platform::screens::number_of(hwnd),
    });
    Seen { front, open }
}

/// The brain is wanted and downloaded (`gaming`: a game fills the screen, the card's memory
/// goes back to it and the classic way answers meanwhile).
pub fn brain_wanted(voice: &VoiceSettings, gaming: bool) -> bool {
    voice.brain
        && !gaming
        && !super::brain::held_off()
        && super::brain::installed(&super::brain::dir())
}
