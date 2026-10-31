//! IPC of the desktop side: hiding, the island (Kysland), screens, shortcuts, starting
//! with Windows, recent apps (registered in `ipc::builder`).

use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Runtime, State, WebviewWindow};
use tauri_specta::Event;

use crate::config::schema::SettingsPatch;
use crate::config::ConfigState;
use crate::desktop::hotkeys::{self, HotkeyProblem, HotkeysReport};
use crate::error::{AppError, ErrorCode};
use crate::ipc::{notify, update_settings};

/// Emitted when the list of recently launched apps changes (most recent first).
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
pub struct RecentsChanged(pub Vec<String>);

/// Remembers a launch for the « récents » list. A failure to save never fails the launch.
pub fn note_recent<R: Runtime>(app: &AppHandle<R>, config: &ConfigState, id: &str) {
    let mut changed = false;
    let saved = config.update_ui_state(|ui| {
        changed = ui.push_recent(id);
        changed
    });
    match saved {
        Ok(()) if changed => notify(RecentsChanged(config.ui_state().recents).emit(app)),
        Ok(()) => {}
        Err(e) => tracing::warn!(error = %e, "could not save the recent apps"),
    }
}

/// Whether the opening animation plays now: once per run of the program, at the first time the
/// main window is on screen (in economy mode the window is built again at every show, so the page
/// cannot remember it itself). A silent start (Windows login) plays none (round 4b).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum OpeningDue {
    /// Play it now (asked once: the next answers are `No`).
    Now,
    /// Not played yet but the window is hidden: ask again when it is shown.
    Later,
    /// Silent start: no opening, but it is still the program's start (asked once, at once, even
    /// hidden, so that the home screen is ready under the first show).
    Quiet,
    /// Express start (step 19): the logo stays still until a click or Enter, then the opening
    /// goes on from there (asked once, at once, even hidden: the logo is ready under the show).
    Express,
    No,
}

/// The opening's once-per-run state.
pub struct OpeningOnce {
    asked: AtomicBool,
    silent: AtomicBool,
    express: AtomicBool,
}

impl OpeningOnce {
    const fn new() -> Self {
        Self {
            asked: AtomicBool::new(false),
            silent: AtomicBool::new(false),
            express: AtomicBool::new(false),
        }
    }

    /// The program was started at login on its home screen (step 19).
    pub fn express_start(&self) {
        self.express.store(true, Ordering::SeqCst);
    }

    /// The program was started silently: no opening in this run.
    pub fn silent_start(&self) {
        self.silent.store(true, Ordering::SeqCst);
    }

    fn due(&self, visible: bool) -> OpeningDue {
        if self.express.load(Ordering::SeqCst) {
            return match self.asked.swap(true, Ordering::SeqCst) {
                true => OpeningDue::No,
                false => OpeningDue::Express,
            };
        }
        let quiet = self.silent.load(Ordering::SeqCst);
        if !quiet && !visible && !self.asked.load(Ordering::SeqCst) {
            return OpeningDue::Later;
        }
        match (self.asked.swap(true, Ordering::SeqCst), quiet) {
            (true, _) => OpeningDue::No,
            (false, true) => OpeningDue::Quiet,
            (false, false) => OpeningDue::Now,
        }
    }
}

pub static OPENING: OpeningOnce = OpeningOnce::new();

#[tauri::command]
#[specta::specta]
pub fn opening_due<R: Runtime>(window: WebviewWindow<R>) -> OpeningDue {
    OPENING.due(window.is_visible().unwrap_or(true))
}

#[tauri::command]
#[specta::specta]
pub fn recents_get(config: State<'_, ConfigState>) -> Vec<String> {
    config.ui_state().recents
}

/// Hides the hub (Escape, the widget's own button…).
#[tauri::command]
#[specta::specta]
pub async fn window_hide<R: Runtime>(app: AppHandle<R>) {
    // Async: in economy mode the window that sent this call is destroyed.
    crate::desktop::hide(&app);
}

/// The page has faded out for passage `id` (round 4b: a change of display mode on screen); the
/// core goes on with the window. `veil`: how the native veil fades when the widget is involved.
#[tauri::command]
#[specta::specta]
pub fn passage_faded<R: Runtime>(
    app: AppHandle<R>,
    id: u32,
    veil: Option<crate::desktop::passage::VeilFade>,
) {
    crate::desktop::passage::faded(&app, id, veil);
}

/// « Après l'intro »: Kysland (`island`) or « Caché »: the intro's window goes (async: a window
/// may be built or destroyed).
#[tauri::command]
#[specta::specta]
pub async fn intro_done<R: Runtime>(app: AppHandle<R>, island: bool) {
    crate::desktop::intro_done(&app, island);
}

/// Shows Kayro (the island's « Passer en immersif »).
#[tauri::command]
#[specta::specta]
pub async fn window_show<R: Runtime>(app: AppHandle<R>) {
    crate::desktop::show(&app);
}

/// Step 20 (Kysland): a press on the island starts its gesture (`calm`: « reduce motion »).
#[tauri::command]
#[specta::specta]
pub fn island_grab<R: Runtime>(app: AppHandle<R>, calm: bool) {
    crate::desktop::island::grab(&app, calm);
}

/// Step 20: where the island is (the page's first frame).
#[tauri::command]
#[specta::specta]
pub fn island_state<R: Runtime>(app: AppHandle<R>) -> crate::desktop::island::IslandState {
    crate::desktop::island::state_now(&app)
}

/// Step 20: the page opens or closes the island (its panel); `calm`: « reduce motion ».
#[tauri::command]
#[specta::specta]
pub fn island_open<R: Runtime>(app: AppHandle<R>, open: bool, calm: bool) {
    crate::desktop::island::set_open(&app, open, calm);
}

/// Step 20: a held frame of the island's effects that its window must not cut (the glitch's
/// spikes on an edge), shown by a click-through layer. Async: rasterised off the interface's
/// thread.
#[tauri::command]
#[specta::specta]
pub async fn island_effects<R: Runtime>(
    app: AppHandle<R>,
    frame: crate::desktop::island::effects::FxFrame,
) {
    crate::desktop::island::effects::show(&app, &frame);
}

/// Step 20: the island's largest size at rest (logical), for its click region.
#[tauri::command]
#[specta::specta]
pub fn island_footprint<R: Runtime>(app: AppHandle<R>, width: f64, height: f64) {
    crate::desktop::island::set_footprint(&app, width, height);
}

/// Step 20: the music playing (Spotify first), read from Windows; starts following the players.
#[tauri::command]
#[specta::specta]
pub async fn media_now<R: Runtime>(app: AppHandle<R>) -> Option<crate::media::NowPlaying> {
    crate::media::now(&app)
}

/// Step 20: previous, play/pause or next on the player shown.
#[tauri::command]
#[specta::specta]
pub async fn media_control<R: Runtime>(
    app: AppHandle<R>,
    action: crate::media::MediaAction,
) -> bool {
    crate::media::control(&app, action)
}

/// Step 20: follow the beat (the island's bars) while music plays and the island shows.
#[tauri::command]
#[specta::specta]
pub fn media_beat<R: Runtime>(app: AppHandle<R>, on: bool) {
    crate::media::beat(&app, on);
}

/// Step 20: the page's effects are over (the window is cut to the island again).
#[tauri::command]
#[specta::specta]
pub fn island_rest() {
    crate::desktop::island::page_at_rest();
}

/// Step 20: the lightness of the screen around the island (0–1), for its colours. Async: one
/// small read of the screen, never on the interface's thread.
#[tauri::command]
#[specta::specta]
pub async fn island_backdrop<R: Runtime>(app: AppHandle<R>) -> Option<f64> {
    crate::desktop::island::backdrop_now(&app)
}

/// The page tells it painted after being shown (measurement only, see `KAYRO_BENCH_SHOW`).
#[tauri::command]
#[specta::specta]
pub fn window_painted<R: Runtime>(app: AppHandle<R>) {
    crate::desktop::painted(&app);
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    /// The screen the immersive mode uses.
    pub chosen: bool,
}

#[tauri::command]
#[specta::specta]
pub fn monitors_list<R: Runtime>(app: AppHandle<R>) -> Vec<MonitorInfo> {
    crate::desktop::screen_names(&app)
        .into_iter()
        .map(|(name, chosen, width, height)| MonitorInfo {
            name,
            width,
            height,
            chosen,
        })
        .collect()
}

/// Picks the screen of the immersive mode (a `name` from `monitors_list`).
#[tauri::command]
#[specta::specta]
pub fn monitor_choose<R: Runtime>(app: AppHandle<R>, name: String) -> Result<(), AppError> {
    crate::desktop::choose_immersive_screen(&app, &name)
}

/// Changes the show/hide shortcut. Refused (`hotkeyConflict`) when another program owns the
/// combination: nothing changes then.
#[tauri::command]
#[specta::specta]
pub async fn hotkey_set<R: Runtime>(app: AppHandle<R>, hotkey: String) -> Result<(), AppError> {
    match hotkeys::set_toggle(&app, &hotkey) {
        Ok(()) => {}
        Err(HotkeyProblem::Invalid) => {
            return Err(AppError::validation("hotkey", "not a valid shortcut"));
        }
        Err(HotkeyProblem::Conflict) => {
            return Err(AppError::new(
                ErrorCode::HotkeyConflict,
                format!("{hotkey} is already used"),
            ));
        }
    }
    update_settings(
        &app,
        SettingsPatch {
            hotkey: Some(hotkey),
            ..Default::default()
        },
    )?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn hotkeys_get(state: State<'_, hotkeys::HotkeyState>) -> HotkeysReport {
    state.report()
}

/// The scene a shortcut asked to confirm, if the page was not there to hear the event.
#[tauri::command]
#[specta::specta]
pub fn scene_hotkey_take<R: Runtime>(app: AppHandle<R>) -> Option<String> {
    crate::desktop::take_pending_scene(&app)
}

/// « Exporter les logs »: zips the log folder into the exports folder, selects it in Explorer
/// and returns its path. Nothing leaves the PC.
#[tauri::command]
#[specta::specta]
pub fn logs_export<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ConfigState>,
) -> Result<String, AppError> {
    let info = app.package_info();
    let infos = format!(
        "{} {}\nWindows : {}\n",
        info.name,
        info.version,
        sysinfo::System::long_os_version().unwrap_or_else(|| "inconnu".into()),
    );
    let path = crate::logs_export::write_zip(
        &crate::paths::logs_dir(),
        &state.paths().exports_dir(),
        &crate::logs_export::today(),
        &infos,
    )?;
    tracing::info!(file = %path.display(), "logs exported");
    crate::ipc_scenes::reveal(&path);
    Ok(path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::{OpeningDue, OpeningOnce};

    #[test]
    fn the_opening_is_due_once_per_run_at_the_first_show() {
        let o = OpeningOnce::new();
        assert_eq!(o.due(false), OpeningDue::Later);
        assert_eq!(o.due(false), OpeningDue::Later);
        assert_eq!(o.due(true), OpeningDue::Now);
        assert_eq!(o.due(true), OpeningDue::No);
        assert_eq!(o.due(false), OpeningDue::No);
    }

    #[test]
    fn a_silent_start_plays_no_opening() {
        // Window built hidden at login: answered at once, nothing waits for the first show.
        let o = OpeningOnce::new();
        o.silent_start();
        assert_eq!(o.due(false), OpeningDue::Quiet);
        assert_eq!(o.due(true), OpeningDue::No);
        // Economy mode: no window at login, the first one is built at the first show.
        let o = OpeningOnce::new();
        o.silent_start();
        assert_eq!(o.due(true), OpeningDue::Quiet);
        assert_eq!(o.due(true), OpeningDue::No);
    }

    #[test]
    fn an_express_start_waits_on_the_logo_once() {
        // Step 19: answered at once even hidden (the logo is ready under the first show).
        let o = OpeningOnce::new();
        o.express_start();
        assert_eq!(o.due(false), OpeningDue::Express);
        assert_eq!(o.due(true), OpeningDue::No);
    }
}

/// Launch cover (30/10, desktop/cover.rs): `on` keeps the hub in front of everything while a game
/// starts behind it (its store's windows stay hidden) and reports the game's window
/// (`LaunchLanded`); off ends it, `hide` taking the hub off the screen.
#[tauri::command]
#[specta::specta]
pub async fn launch_cover<R: Runtime>(app: AppHandle<R>, on: bool, hide: bool) {
    if on {
        crate::desktop::cover::start(&app);
    } else {
        crate::desktop::cover::end(&app, hide);
    }
}
