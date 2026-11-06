//! Scene operations that go beyond « save »: delete, preview an import, import.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::schema::SceneFile;
use super::share::HubSceneFile;
use super::{deaccent, lock, validate, ConfigState};
use crate::error::AppError;

/// One slot of a file about to be imported, with the app it would be linked to by default.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportSlot {
    pub name: String,
    /// The app this slot is already linked to on this machine (if that app still exists).
    pub suggested_app: Option<String>,
}

/// What the interface shows before importing: nothing is written yet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub name: String,
    pub step_count: u32,
    pub slots: Vec<ImportSlot>,
}

/// `Soirée gaming` → `soiree-gaming`; `-2`, `-3`… appended when the id is taken.
fn scene_id(name: &str, taken: impl Fn(&str) -> bool) -> String {
    let mut slug = String::new();
    for c in name.to_lowercase().chars().map(deaccent) {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug: String = slug.trim_matches('-').chars().take(34).collect();
    let slug = match slug.trim_end_matches('-') {
        "" => "scene".to_string(),
        s => s.to_string(),
    };
    if !taken(&slug) {
        return slug;
    }
    (2u32..)
        .map(|n| format!("{slug}-{n}"))
        .find(|id| !taken(id))
        .unwrap_or(slug)
}

impl ConfigState {
    /// Deletes a scene and its file. Slots are left alone (other scenes may use them).
    pub fn delete_scene(&self, id: &str) -> Result<(), AppError> {
        // `id` becomes part of a file name: only the strict id alphabet gets that far.
        validate::validate_id(id).map_err(|_| AppError::validation("id", "invalid scene id"))?;
        let mut guard = lock(&self.scenes);
        if !guard.iter().any(|s| s.id == id) {
            return Err(AppError::not_found(format!("scene «{id}»")));
        }
        let path = self.paths.scenes_dir().join(format!("{id}.json"));
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
        guard.retain(|s| s.id != id);
        Ok(())
    }

    /// A scene id not used by any scene yet, derived from `name` (the editor's first save).
    pub fn new_scene_id(&self, name: &str) -> String {
        let scenes = lock(&self.scenes);
        scene_id(name, |id| scenes.iter().any(|s| s.id == id))
    }

    pub fn preview_import(&self, file: &HubSceneFile) -> ImportPreview {
        let slots = self.slots().slots;
        let apps = self.apps().apps;
        ImportPreview {
            name: file.name.clone(),
            step_count: u32::try_from(file.steps.len()).unwrap_or(u32::MAX),
            slots: file
                .slots
                .iter()
                .map(|name| ImportSlot {
                    name: name.clone(),
                    suggested_app: slots
                        .get(name)
                        .filter(|app_id| apps.iter().any(|a| &a.id == *app_id))
                        .cloned(),
                })
                .collect(),
        }
    }

    /// Imports a validated file as a new scene (never replacing one) and links its slots to the
    /// apps in `links` (slot name → app id). A slot absent from `links` is left as it is.
    pub fn import_scene(
        &self,
        file: &HubSceneFile,
        links: &BTreeMap<String, String>,
    ) -> Result<SceneFile, AppError> {
        file.check()
            .map_err(|message| AppError::validation("file", message))?;
        let apps = self.apps().apps;
        for (slot, app_id) in links {
            if !file.slots.contains(slot) {
                return Err(AppError::validation(
                    "links",
                    format!("unknown slot «{slot}»"),
                ));
            }
            if !apps.iter().any(|a| &a.id == app_id) {
                return Err(AppError::not_found(format!("app «{app_id}»")));
            }
        }

        let names: Vec<String> = self.scenes().into_iter().map(|s| s.name).collect();
        let mut name = file.name.clone();
        for n in 2u32.. {
            if !names.contains(&name) {
                break;
            }
            name = format!("{} ({n})", file.name.chars().take(190).collect::<String>());
        }
        let scene = SceneFile {
            schema_version: 1,
            id: self.new_scene_id(&name),
            name,
            hotkey: None,
            steps: file.steps.clone(),
        };
        let saved = self.save_scene(scene)?;

        if !links.is_empty() {
            let mut merged = self.slots().slots;
            merged.extend(links.clone());
            self.set_slots(merged)?;
        }
        Ok(saved)
    }
}
