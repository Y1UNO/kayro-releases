//! User data: versioned JSON in `%APPDATA%/Hub`, atomic writes, migrations, and recovery from
//! damaged files. `ConfigState` is the single in-memory copy the IPC commands work on.

pub mod apps;
pub mod atomic;
pub mod dirstore;
pub mod migrate;
pub mod schema;
pub mod store;
pub mod validate;

use std::sync::{Mutex, MutexGuard};
use std::time::Instant;

use crate::error::{AppError, ErrorCode};
use crate::paths::DataPaths;
use apps::{AppEntry, AppSource, AppsFile, NewApp};
use schema::{SceneFile, Settings, SettingsPatch, SlotsFile, ThemeFile};

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub struct ConfigState {
    paths: DataPaths,
    settings: Mutex<Settings>,
    apps: Mutex<AppsFile>,
    slots: Mutex<SlotsFile>,
    scenes: Vec<SceneFile>,
    themes: Vec<ThemeFile>,
}

impl ConfigState {
    /// Reads everything. Never fails: damaged files are set aside and replaced by defaults.
    pub fn load(paths: DataPaths) -> Self {
        let started = Instant::now();
        let (settings, _) = store::load::<Settings>(&paths.settings());
        let (apps, _) = store::load::<AppsFile>(&paths.apps());
        let (slots, _) = store::load::<SlotsFile>(&paths.slots());
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
            scenes,
            themes,
        }
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

    pub fn apps(&self) -> AppsFile {
        lock(&self.apps).clone()
    }

    pub fn add_app(&self, new: NewApp) -> Result<AppEntry, AppError> {
        validate::validate_new_app(&new)?;
        let mut guard = lock(&self.apps);
        if guard.apps.len() >= validate::MAX_APPS {
            return Err(AppError::new(ErrorCode::Validation, "too many apps"));
        }
        if !matches!(new.source, AppSource::Manual | AppSource::Startmenu)
            && guard.apps.iter().any(|a| a.source == new.source)
        {
            return Err(AppError::new(
                ErrorCode::Duplicate,
                "this app is already in the list",
            ));
        }
        let id = unique_id(&new.name, &guard);
        let entry = new.with_id(id);
        let mut next = guard.clone();
        next.apps.push(entry.clone());
        store::save(&self.paths.apps(), &next)?;
        *guard = next;
        Ok(entry)
    }

    pub fn update_app(&self, app: AppEntry) -> Result<AppEntry, AppError> {
        validate::validate_app(&app)?;
        let mut guard = lock(&self.apps);
        let mut next = guard.clone();
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

    pub fn scenes(&self) -> &[SceneFile] {
        &self.scenes
    }

    pub fn themes(&self) -> &[ThemeFile] {
        &self.themes
    }
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
mod store_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod validate_tests;
