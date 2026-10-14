//! The `kayro-art` protocol: `http://kayro-art.localhost/<appId>/<role>?v=<stamp>` on Windows.
//! The page names an app and a role, never a file; the core finds the file, checks that it lies
//! under one of the two art roots, that it is small enough and that its bytes are an image.

use std::fs;
use std::path::Path;

use tauri::http::{header, Request, Response, StatusCode};
use tauri::{Manager, Runtime, UriSchemeContext, UriSchemeResponder};

use super::{find, sniff, ArtRole, ArtRoots, ArtState, MAX_BYTES};
use crate::config::apps::AppEntry;
use crate::config::validate::validate_id;
use crate::config::ConfigState;

pub const SCHEME: &str = "kayro-art";

#[derive(Debug, PartialEq, Eq)]
pub enum Answer {
    Image { bytes: Vec<u8>, mime: &'static str },
    NotFound,
    BadRequest,
}

/// `/<appId>/<role>`, exactly; anything else (more segments, `..`, encoded characters) is refused.
pub fn parse(path: &str) -> Option<(&str, ArtRole)> {
    let mut parts = path.strip_prefix('/')?.split('/');
    let (id, role, rest) = (parts.next()?, parts.next()?, parts.next());
    if rest.is_some() || validate_id(id).is_err() {
        return None;
    }
    Some((id, ArtRole::from_slug(role)?))
}

/// True when `path` really lies under `root` (links and `..` resolved).
fn inside(path: &Path, root: &Path) -> bool {
    match (fs::canonicalize(path), fs::canonicalize(root)) {
        (Ok(p), Ok(r)) => p.starts_with(r),
        _ => false,
    }
}

pub fn answer(roots: &ArtRoots, apps: &[AppEntry], path: &str) -> Answer {
    let Some((id, role)) = parse(path) else {
        return Answer::BadRequest;
    };
    let Some(app) = apps.iter().find(|a| a.id == id) else {
        return Answer::NotFound;
    };
    let Some(found) = find(roots, app, role) else {
        return Answer::NotFound;
    };
    let allowed = inside(&found.path, &roots.user)
        || roots
            .steam_cache
            .as_deref()
            .is_some_and(|c| inside(&found.path, c));
    let small = fs::metadata(&found.path).is_ok_and(|m| m.len() <= MAX_BYTES);
    if !allowed || !small {
        tracing::warn!(app = id, role = role.slug(), "art: file refused");
        return Answer::NotFound;
    }
    match fs::read(&found.path) {
        Ok(bytes) => match sniff(&bytes) {
            Some((mime, _)) => Answer::Image { bytes, mime },
            None => Answer::NotFound,
        },
        Err(_) => Answer::NotFound,
    }
}

fn response(answer: Answer) -> Response<Vec<u8>> {
    let builder = Response::builder()
        // WebGL reads the posters as textures: the page (another origin) must be allowed to.
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
    let built = match answer {
        // The URL carries the file's stamp: a changed image gets a new URL.
        Answer::Image { bytes, mime } => builder
            .header(header::CONTENT_TYPE, mime)
            .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
            .body(bytes),
        Answer::NotFound => builder
            .status(StatusCode::NOT_FOUND)
            .header(header::CACHE_CONTROL, "no-store")
            .body(Vec::new()),
        Answer::BadRequest => builder.status(StatusCode::BAD_REQUEST).body(Vec::new()),
    };
    built.unwrap_or_else(|_| Response::new(Vec::new()))
}

/// Protocol handler: the file is read off the interface thread.
pub fn handle<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    if request.method() != tauri::http::Method::GET {
        return responder.respond(response(Answer::BadRequest));
    }
    let app = ctx.app_handle().clone();
    let path = request.uri().path().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let (Some(art), Some(config)) =
            (app.try_state::<ArtState>(), app.try_state::<ConfigState>())
        else {
            return responder.respond(response(Answer::NotFound));
        };
        responder.respond(response(answer(&art.roots, &config.apps().apps, &path)));
    });
}
