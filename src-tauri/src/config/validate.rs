//! Pure validation of everything that crosses the IPC boundary or is read from user files.
//! The hub only ever launches what passes these checks: closed set of launch kinds, absolute
//! paths without `..`, protocol allow-list.

use std::path::{Component, Path};

use super::apps::{AppEntry, Launch, NewApp};
use super::schema::{Settings, ATMOSPHERE_MAX, ATMOSPHERE_MIN};
use crate::error::AppError;

pub const MAX_APPS: usize = 2000;
const MAX_NAME: usize = 80;
const MAX_PATH: usize = 520;
const MAX_ARGS: usize = 32;
const MAX_ARG_LEN: usize = 1024;
const MAX_URI: usize = 2048;
const URI_SCHEMES: [&str; 2] = ["steam", "com.epicgames.launcher"];
const MODIFIERS: [&str; 7] = ["ctrl", "alt", "shift", "super", "win", "meta", "cmdorctrl"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError {
    pub field: &'static str,
    pub message: String,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.field, self.message)
    }
}

impl From<ValidationError> for AppError {
    fn from(e: ValidationError) -> Self {
        AppError::validation(e.field, e.message)
    }
}

type Check = Result<(), ValidationError>;

fn err(field: &'static str, message: impl Into<String>) -> Check {
    Err(ValidationError {
        field,
        message: message.into(),
    })
}

/// `^[a-z0-9-]{1,40}$`
pub fn validate_id(id: &str) -> Check {
    let ok = (1..=40).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if ok {
        Ok(())
    } else {
        err("id", "must be 1–40 characters of a-z, 0-9 and «-»")
    }
}

fn text(field: &'static str, value: &str, max: usize) -> Check {
    let n = value.chars().count();
    if n == 0 || n > max {
        return err(field, format!("must be 1–{max} characters"));
    }
    if value.chars().any(char::is_control) {
        return err(field, "must not contain control characters");
    }
    Ok(())
}

fn path(field: &'static str, value: &str, extension: Option<&str>) -> Check {
    text(field, value, MAX_PATH)?;
    let p = Path::new(value);
    if !p.is_absolute() {
        return err(field, "must be an absolute path");
    }
    if p.components().any(|c| matches!(c, Component::ParentDir)) {
        return err(field, "must not contain «..»");
    }
    if let Some(ext) = extension {
        let matches = p.extension().is_some_and(|e| e.eq_ignore_ascii_case(ext));
        if !matches {
            return err(field, format!("must end with .{ext}"));
        }
    }
    Ok(())
}

fn relative_asset(field: &'static str, value: &Option<String>) -> Check {
    let Some(v) = value else { return Ok(()) };
    text(field, v, MAX_PATH)?;
    let p = Path::new(v);
    let plain = p.components().all(|c| matches!(c, Component::Normal(_)));
    if p.is_absolute() || !plain || !v.starts_with("cache/art/") {
        return err(field, "must be a relative path under cache/art/");
    }
    Ok(())
}

fn launch(l: &Launch) -> Check {
    match l {
        Launch::Exe {
            path: p, args, cwd, ..
        } => {
            path("launch.path", p, Some("exe"))?;
            if args.len() > MAX_ARGS {
                return err("launch.args", format!("at most {MAX_ARGS} arguments"));
            }
            for a in args {
                if a.chars().count() > MAX_ARG_LEN || a.contains('\0') {
                    return err("launch.args", "argument too long or invalid");
                }
            }
            if let Some(c) = cwd {
                path("launch.cwd", c, None)?;
            }
            Ok(())
        }
        Launch::Lnk { path: p } => path("launch.path", p, Some("lnk")),
        Launch::Uri { uri } => {
            text("launch.uri", uri, MAX_URI)?;
            match uri.split_once("://") {
                Some((scheme, rest)) if URI_SCHEMES.contains(&scheme) && !rest.is_empty() => Ok(()),
                _ => err("launch.uri", "protocol not allowed"),
            }
        }
        Launch::Uwp { aumid } => {
            text("launch.aumid", aumid, 256)?;
            let part = |s: &str| {
                !s.is_empty()
                    && s.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
            };
            match aumid.split_once('!') {
                Some((pkg, app)) if part(pkg) && part(app) => Ok(()),
                _ => err("launch.aumid", "expected «PackageFamilyName!AppId»"),
            }
        }
        Launch::Url { url } => {
            text("launch.url", url, MAX_URI)?;
            let host = url
                .strip_prefix("https://")
                .or_else(|| url.strip_prefix("http://"));
            if host.is_some_and(|h| !h.is_empty() && !h.starts_with('/')) {
                Ok(())
            } else {
                err("launch.url", "only http(s) addresses are allowed")
            }
        }
    }
}

pub fn validate_app(app: &AppEntry) -> Check {
    validate_id(&app.id)?;
    validate_fields(
        &app.name,
        &app.category,
        &app.launch,
        &app.match_rule.exe,
        &app.art.poster,
        &app.art.hero,
        &app.mood_id,
    )?;
    match &app.colors {
        Some(c) => super::game_colors::validate_app_colors(c).or_else(|e| err("colors", e)),
        None => Ok(()),
    }
}

pub fn validate_new_app(app: &NewApp) -> Check {
    validate_fields(
        &app.name,
        &app.category,
        &app.launch,
        &app.match_rule.exe,
        &app.art.poster,
        &app.art.hero,
        &app.mood_id,
    )
}

fn validate_fields(
    name: &str,
    category: &str,
    l: &Launch,
    match_exe: &Option<String>,
    poster: &Option<String>,
    hero: &Option<String>,
    mood_id: &Option<String>,
) -> Check {
    text("name", name, MAX_NAME)?;
    text("category", category, 40)?;
    launch(l)?;
    if let Some(exe) = match_exe {
        text("match.exe", exe, 260)?;
        let plain = !exe.contains(['/', '\\']) && exe.to_ascii_lowercase().ends_with(".exe");
        if !plain {
            return err("match.exe", "must be a bare file name ending in .exe");
        }
    }
    relative_asset("art.poster", poster)?;
    relative_asset("art.hero", hero)?;
    if let Some(m) = mood_id {
        validate_id(m).or_else(|_| err("moodId", "invalid mood id"))?;
    }
    Ok(())
}

pub fn hotkey(value: &str) -> Check {
    text("hotkey", value, 64)?;
    let parts: Vec<&str> = value.split('+').map(str::trim).collect();
    let Some((key, mods)) = parts.split_last() else {
        return err("hotkey", "empty");
    };
    let key_ok =
        !key.is_empty() && key.len() <= 12 && key.bytes().all(|b| b.is_ascii_alphanumeric());
    let mods_ok = !mods.is_empty()
        && mods
            .iter()
            .all(|m| MODIFIERS.contains(&m.to_ascii_lowercase().as_str()));
    if key_ok && mods_ok {
        Ok(())
    } else {
        err("hotkey", "expected modifiers and a key, e.g. «Ctrl+Alt+H»")
    }
}

pub fn validate_settings(s: &Settings) -> Check {
    validate_id(&s.theme_id).or_else(|_| err("themeId", "invalid theme id"))?;
    hotkey(&s.hotkey)?;
    if s.language != "fr" {
        return err("language", "unsupported language");
    }
    let a = s.atmosphere_intensity;
    if !(ATMOSPHERE_MIN..=ATMOSPHERE_MAX).contains(&a) {
        return err("atmosphereIntensity", "must be between 0.3 and 1.3");
    }
    Ok(())
}
