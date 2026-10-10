//! Global shortcuts: the one that shows/hides the hub, and one per scene that has a `hotkey`.
//! Windows hands a combination to a single program: a refusal means another program owns it, and
//! the interface is told so (`HotkeysReport`) instead of the failure staying in a log.

use std::str::FromStr;
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_specta::Event;

use crate::config::ConfigState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum HotkeyProblem {
    /// Not a combination the hub can register.
    Invalid,
    /// Taken by another program, or already used by another shortcut of the hub.
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyStatus {
    pub hotkey: String,
    pub problem: Option<HotkeyProblem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SceneHotkeyStatus {
    pub scene_id: String,
    pub hotkey: String,
    pub problem: Option<HotkeyProblem>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HotkeysReport {
    pub toggle: Option<HotkeyStatus>,
    pub scenes: Vec<SceneHotkeyStatus>,
}

/// Emitted whenever registrations change (start, new shortcut, scenes saved or deleted).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct HotkeysChanged(pub HotkeysReport);

/// What a pressed shortcut stands for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    Toggle,
    Scene(String),
}

#[derive(Default)]
struct Inner {
    toggle: Option<Shortcut>,
    scenes: Vec<(Shortcut, String)>,
    report: HotkeysReport,
}

#[derive(Default)]
pub struct HotkeyState(Mutex<Inner>);

impl HotkeyState {
    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.0.lock().unwrap_or_else(|p| p.into_inner())
    }

    pub fn report(&self) -> HotkeysReport {
        self.lock().report.clone()
    }

    pub fn action_for(&self, id: u32) -> Option<Action> {
        let inner = self.lock();
        if inner.toggle.is_some_and(|s| s.id() == id) {
            return Some(Action::Toggle);
        }
        inner
            .scenes
            .iter()
            .find(|(s, _)| s.id() == id)
            .map(|(_, scene)| Action::Scene(scene.clone()))
    }
}

/// `"Ctrl+Alt+H"` as written by the settings and the scene editor.
pub fn parse(hotkey: &str) -> Option<Shortcut> {
    Shortcut::from_str(hotkey.trim()).ok()
}

fn emit<R: Runtime>(app: &AppHandle<R>, report: HotkeysReport) {
    crate::ipc::notify(HotkeysChanged(report).emit(app));
}

/// Registers the show/hide shortcut and the scene shortcuts. Call once at start-up.
pub fn init<R: Runtime>(app: &AppHandle<R>) {
    let hotkey = app.state::<ConfigState>().settings().hotkey;
    let status = register_toggle(app, &hotkey);
    app.state::<HotkeyState>().lock().report.toggle = Some(status);
    sync_scenes(app);
}

fn register_toggle<R: Runtime>(app: &AppHandle<R>, hotkey: &str) -> HotkeyStatus {
    let state = app.state::<HotkeyState>();
    let problem = match parse(hotkey) {
        None => Some(HotkeyProblem::Invalid),
        Some(shortcut) => match app.global_shortcut().register(shortcut) {
            Ok(()) => {
                state.lock().toggle = Some(shortcut);
                None
            }
            Err(e) => {
                tracing::warn!(hotkey, error = %e, "could not register the show/hide shortcut");
                Some(HotkeyProblem::Conflict)
            }
        },
    };
    HotkeyStatus {
        hotkey: hotkey.to_string(),
        problem,
    }
}

/// Replaces the show/hide shortcut. The new one is registered **before** the old one is let
/// go, so a refusal leaves everything as it was.
pub fn set_toggle<R: Runtime>(app: &AppHandle<R>, hotkey: &str) -> Result<(), HotkeyProblem> {
    let state = app.state::<HotkeyState>();
    let shortcut = parse(hotkey).ok_or(HotkeyProblem::Invalid)?;
    let (old, taken_by_scene) = {
        let inner = state.lock();
        (
            inner.toggle,
            inner.scenes.iter().any(|(s, _)| s.id() == shortcut.id()),
        )
    };
    if old.is_some_and(|o| o.id() == shortcut.id()) {
        return Ok(());
    }
    if taken_by_scene {
        return Err(HotkeyProblem::Conflict);
    }
    let shortcuts = app.global_shortcut();
    shortcuts.register(shortcut).map_err(|e| {
        tracing::info!(hotkey, error = %e, "shortcut refused");
        HotkeyProblem::Conflict
    })?;
    if let Some(old) = old {
        if let Err(e) = shortcuts.unregister(old) {
            tracing::warn!(error = %e, "could not release the previous shortcut");
        }
    }
    let report = {
        let mut inner = state.lock();
        inner.toggle = Some(shortcut);
        inner.report.toggle = Some(HotkeyStatus {
            hotkey: hotkey.to_string(),
            problem: None,
        });
        inner.report.clone()
    };
    emit(app, report);
    Ok(())
}

/// Re-registers the shortcuts of all scenes (after a scene was saved, imported or deleted).
pub fn sync_scenes<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<HotkeyState>();
    let shortcuts = app.global_shortcut();
    let previous = std::mem::take(&mut state.lock().scenes);
    for (shortcut, _) in &previous {
        let _ = shortcuts.unregister(*shortcut);
    }

    let toggle = state.lock().toggle;
    let mut registered: Vec<(Shortcut, String)> = Vec::new();
    let mut statuses = Vec::new();
    for scene in app.state::<ConfigState>().scenes() {
        let Some(hotkey) = scene.hotkey.clone() else {
            continue;
        };
        let problem = match parse(&hotkey) {
            None => Some(HotkeyProblem::Invalid),
            Some(shortcut)
                if toggle.is_some_and(|t| t.id() == shortcut.id())
                    || registered.iter().any(|(s, _)| s.id() == shortcut.id()) =>
            {
                Some(HotkeyProblem::Conflict)
            }
            Some(shortcut) => match shortcuts.register(shortcut) {
                Ok(()) => {
                    registered.push((shortcut, scene.id.clone()));
                    None
                }
                Err(e) => {
                    tracing::warn!(scene = %scene.id, hotkey, error = %e, "scene shortcut refused");
                    Some(HotkeyProblem::Conflict)
                }
            },
        };
        statuses.push(SceneHotkeyStatus {
            scene_id: scene.id,
            hotkey,
            problem,
        });
    }
    let report = {
        let mut inner = state.lock();
        inner.scenes = registered;
        inner.report.scenes = statuses;
        inner.report.clone()
    };
    emit(app, report);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every combination the interface can produce (`src/features/scenes/hotkey.ts`).
    #[test]
    fn the_interfaces_combinations_parse() {
        for key in ["A", "Z", "0", "9", "F1", "F9", "F12", "F24", "Space"] {
            for mods in [
                "Ctrl",
                "Alt",
                "Shift",
                "Super",
                "Ctrl+Alt",
                "Ctrl+Alt+Shift",
                "Ctrl+Super",
            ] {
                let text = format!("{mods}+{key}");
                assert!(parse(&text).is_some(), "{text} should parse");
            }
        }
    }

    #[test]
    fn same_combination_written_differently_is_the_same_shortcut() {
        assert_eq!(
            parse("Ctrl+Alt+H").unwrap().id(),
            parse("ctrl+alt+h").unwrap().id()
        );
        assert_eq!(
            parse("Ctrl+Alt+H").unwrap().id(),
            parse("Alt+Ctrl+H").unwrap().id()
        );
        assert_ne!(
            parse("Ctrl+Alt+H").unwrap().id(),
            parse("Ctrl+Alt+J").unwrap().id()
        );
    }

    #[test]
    fn nonsense_does_not_parse() {
        for bad in ["", "Ctrl+", "+H", "Ctrl+Alt+Nope", "Ctrl+H+J"] {
            assert!(parse(bad).is_none(), "{bad:?} should not parse");
        }
    }

    #[test]
    fn pressed_ids_map_back_to_their_action() {
        let state = HotkeyState::default();
        let toggle = parse("Ctrl+Alt+H").unwrap();
        let scene = parse("Ctrl+Alt+1").unwrap();
        {
            let mut inner = state.lock();
            inner.toggle = Some(toggle);
            inner.scenes.push((scene, "soiree".into()));
        }
        assert_eq!(state.action_for(toggle.id()), Some(Action::Toggle));
        assert_eq!(
            state.action_for(scene.id()),
            Some(Action::Scene("soiree".into()))
        );
        assert_eq!(state.action_for(1), None);
    }
}
