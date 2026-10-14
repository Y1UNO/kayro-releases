//! User data: versioned JSON in `%APPDATA%/Kayro`, atomic writes, migrations, and recovery from
//! damaged files. `ConfigState` is the single in-memory copy the IPC commands work on.

pub mod apps;
pub mod atomic;
pub mod dirstore;
pub mod migrate;
pub mod scene;
pub mod scene_ops;
pub mod schema;
pub mod share;
pub mod store;
pub mod ui_state;
pub mod validate;
pub mod visual;

use std::collections::BTreeMap;
use std::sync::{Mutex, MutexGuard};
use std::time::Instant;

use crate::error::{AppError, ErrorCode};
use crate::paths::DataPaths;
use apps::{AddFailure, AddReport, AppEntry, AppSource, AppsFile, NewApp};
use schema::{SceneFile, Settings, SettingsPatch, SlotsFile, StrictFile, ThemeFile};
use ui_state::UiState;

const MAX_SCENES: usize = 500;
const MAX_SLOTS: usize = 200;

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub struct ConfigState {
    paths: DataPaths,
    settings: Mutex<Settings>,
    apps: Mutex<AppsFile>,
    slots: Mutex<SlotsFile>,
    scenes: Mutex<Vec<SceneFile>>,
    ui_state: Mutex<UiState>,
    themes: Vec<ThemeFile>,
}

impl ConfigState {
    /// Reads everything. Never fails: damaged files are set aside and replaced by defaults.
    pub fn load(paths: DataPaths) -> Self {
        let started = Instant::now();
        let (settings, _) = store::load::<Settings>(&paths.settings());
        let (apps, _) = store::load::<AppsFile>(&paths.apps());
        let (slots, _) = store::load::<SlotsFile>(&paths.slots());
        let (ui_state, _) = store::load::<UiState>(&paths.ui_state());
        let scenes = dirstore::load_dir::<SceneFile>(&paths.scenes_dir());
        let themes = dirstore::load_dir::<ThemeFile>(&paths.themes_dir());
        tracing::info!(
            apps = apps.apps.len(),
            scenes = scenes.len(),
            themes = themes.len(),
            elapsed_us = started.elapsed().as_micros() as u64,
            "config loaded"
        );
        Self {
            paths,
            settings: Mutex::new(settings),
            apps: Mutex::new(apps),
            slots: Mutex::new(slots),
            scenes: Mutex::new(scenes),
            ui_state: Mutex::new(ui_state),
            themes,
        }
    }

    pub fn paths(&self) -> &DataPaths {
        &self.paths
    }

    pub fn settings(&self) -> Settings {
        lock(&self.settings).clone()
    }

    pub fn set_settings(&self, patch: SettingsPatch) -> Result<Settings, AppError> {
        let mut guard = lock(&self.settings);
        let mut next = guard.clone();
        next.apply(patch);
        validate::validate_settings(&next)?;
        store::save(&self.paths.settings(), &next)?;
        *guard = next.clone();
        Ok(next)
    }

    pub fn ui_state(&self) -> UiState {
        lock(&self.ui_state).clone()
    }

    /// Applies `change` and writes `state.json` when it reports a change (true).
    pub fn update_ui_state(
        &self,
        change: impl FnOnce(&mut UiState) -> bool,
    ) -> std::io::Result<()> {
        let mut guard = lock(&self.ui_state);
        let mut next = guard.clone();
        if change(&mut next) {
            store::save(&self.paths.ui_state(), &next)?;
            *guard = next;
        }
        Ok(())
    }

    pub fn apps(&self) -> AppsFile {
        lock(&self.apps).clone()
    }

    pub fn add_app(&self, new: NewApp) -> Result<AppEntry, AppError> {
        let mut guard = lock(&self.apps);
        let mut next = guard.clone();
        let entry = push_app(&mut next, new)?;
        store::save(&self.paths.apps(), &next)?;
        *guard = next;
        Ok(entry)
    }

    /// Adds several apps with one write. An app that is refused (invalid, duplicate…) does not
    /// stop the others: it is reported with its position in `news`.
    pub fn add_apps(&self, news: Vec<NewApp>) -> Result<AddReport, AppError> {
        let mut guard = lock(&self.apps);
        let mut next = guard.clone();
        let mut report = AddReport::default();
        for (index, new) in news.into_iter().enumerate() {
            match push_app(&mut next, new) {
                Ok(entry) => report.added.push(entry),
                Err(error) => report.failed.push(AddFailure {
                    index: u32::try_from(index).unwrap_or(u32::MAX),
                    error,
                }),
            }
        }
        if !report.added.is_empty() {
            store::save(&self.paths.apps(), &next)?;
            *guard = next;
        }
        Ok(report)
    }

    pub fn update_app(&self, app: AppEntry) -> Result<AppEntry, AppError> {
        validate::validate_app(&app)?;
        let mut guard = lock(&self.apps);
        let mut next = guard.clone();
        if next
            .apps
            .iter()
            .any(|a| a.id != app.id && a.launch.target_key() == app.launch.target_key())
        {
            return Err(AppError::new(
                ErrorCode::Duplicate,
                "another app already starts this target",
            ));
        }
        let slot = next
            .apps
            .iter_mut()
            .find(|a| a.id == app.id)
            .ok_or_else(|| AppError::not_found(format!("app «{}»", app.id)))?;
        *slot = app.clone();
        store::save(&self.paths.apps(), &next)?;
        *guard = next;
        Ok(app)
    }

    pub fn remove_app(&self, id: &str) -> Result<(), AppError> {
        let mut guard = lock(&self.apps);
        let mut next = guard.clone();
        let before = next.apps.len();
        next.apps.retain(|a| a.id != id);
        if next.apps.len() == before {
            return Err(AppError::not_found(format!("app «{id}»")));
        }
        store::save(&self.paths.apps(), &next)?;
        *guard = next;
        Ok(())
    }

    pub fn slots(&self) -> SlotsFile {
        lock(&self.slots).clone()
    }

    /// Replaces all slots at once (slot name → app id). Linking to an app that is later removed
    /// is allowed: the scene engine then skips the step and says so.
    pub fn set_slots(&self, slots: BTreeMap<String, String>) -> Result<SlotsFile, AppError> {
        if slots.len() > MAX_SLOTS {
            return Err(AppError::validation("slots", "too many slots"));
        }
        for (name, app_id) in &slots {
            validate::validate_id(name)
                .and_then(|()| validate::validate_id(app_id))
                .map_err(|_| AppError::validation("slots", format!("bad slot «{name}»")))?;
        }
        let mut guard = lock(&self.slots);
        let next = SlotsFile {
            schema_version: guard.schema_version,
            slots,
        };
        store::save(&self.paths.slots(), &next)?;
        *guard = next.clone();
        Ok(next)
    }

    pub fn scenes(&self) -> Vec<SceneFile> {
        lock(&self.scenes).clone()
    }

    pub fn scene(&self, id: &str) -> Option<SceneFile> {
        lock(&self.scenes).iter().find(|s| s.id == id).cloned()
    }

    /// Validates then writes `scenes/<id>.json` (replacing a scene with the same id).
    pub fn save_scene(&self, scene: SceneFile) -> Result<SceneFile, AppError> {
        scene
            .check()
            .map_err(|message| AppError::validation("scene", message))?;
        let mut guard = lock(&self.scenes);
        let is_new = !guard.iter().any(|s| s.id == scene.id);
        if is_new && guard.len() >= MAX_SCENES {
            return Err(AppError::validation("scene", "too many scenes"));
        }
        let mut bytes = serde_json::to_vec_pretty(&scene).map_err(std::io::Error::other)?;
        bytes.push(b'\n');
        let path = self.paths.scenes_dir().join(format!("{}.json", scene.id));
        atomic::write_atomic(&path, &bytes)?;
        match guard.iter_mut().find(|s| s.id == scene.id) {
            Some(slot) => *slot = scene.clone(),
            None => {
                guard.push(scene.clone());
                guard.sort_by(|a, b| a.id.cmp(&b.id));
            }
        }
        Ok(scene)
    }

    pub fn themes(&self) -> &[ThemeFile] {
        &self.themes
    }
}

/// Validates `new` and appends it to `file` (not saved here).
fn push_app(file: &mut AppsFile, new: NewApp) -> Result<AppEntry, AppError> {
    validate::validate_new_app(&new)?;
    if file.apps.len() >= validate::MAX_APPS {
        return Err(AppError::new(ErrorCode::Validation, "too many apps"));
    }
    let same_store_entry = !matches!(new.source, AppSource::Manual | AppSource::Startmenu)
        && file.apps.iter().any(|a| a.source == new.source);
    let key = new.launch.target_key();
    if same_store_entry || file.apps.iter().any(|a| a.launch.target_key() == key) {
        return Err(AppError::new(
            ErrorCode::Duplicate,
            "this app is already in the list",
        ));
    }
    let id = unique_id(&new.name, file);
    let entry = new.with_id(id);
    file.apps.push(entry.clone());
    Ok(entry)
}

fn deaccent(c: char) -> char {
    match c {
        'à' | 'â' | 'ä' => 'a',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'î' | 'ï' => 'i',
        'ô' | 'ö' => 'o',
        'ù' | 'û' | 'ü' => 'u',
        'ç' => 'c',
        other => other,
    }
}

/// `Half-Life 2` → `half-life-2`; `-2`, `-3`… appended when the id is taken.
fn unique_id(name: &str, apps: &AppsFile) -> String {
    let mut slug = String::new();
    for c in name.to_lowercase().chars().map(deaccent) {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let mut slug = slug.trim_matches('-').chars().take(34).collect::<String>();
    slug = slug.trim_end_matches('-').to_string();
    if slug.is_empty() {
        slug = "app".into();
    }
    let taken = |id: &str| apps.apps.iter().any(|a| a.id == id);
    if !taken(&slug) {
        return slug;
    }
    (2u32..)
        .map(|n| format!("{slug}-{n}"))
        .find(|id| !taken(id))
        .unwrap_or(slug)
}

#[cfg(test)]
mod scene_tests;
#[cfg(test)]
mod settings_r5_tests;
#[cfg(test)]
mod store_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod validate_tests;
