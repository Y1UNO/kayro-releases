//! The apps Windows starts at login, switched on and off the way the Task Manager does it: the
//! program's entry (`Run` key, Startup folder) is never touched, only its mark in
//! `Explorer\StartupApproved`, so that every change can be undone. Only the user's own entries
//! change (no administrator rights); the machine's, Windows' own and Kayro itself stay as they are.
//! What Kayro switched off is written in a journal (`startup-journal.json`) to be put back.
//!
//! Microsoft does not document `StartupApproved` publicly; its format is known from use and was
//! seen on the test PC at step 12: 12 bytes, the first one even = on (`02`, `06`), odd = off
//! (`03` + the date it was switched off, a FILETIME). No mark = on. Store apps have their own
//! switch (`store_task.rs`).

mod journal;
#[cfg(windows)]
mod registry;
mod store_task;
#[cfg(test)]
mod tests;

use std::io;
use std::path::Path;

use serde::Serialize;

pub use journal::Journal;
#[cfg(windows)]
pub use registry::Registry;

/// Whose entry it is: the user's (changeable) or the whole machine's (needs rights: never changed).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Scope {
    User,
    Machine,
}

/// Where Windows reads it, and so which `StartupApproved` key holds its mark.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Place {
    Run,
    /// The 32-bit `Run` key of the machine (`WOW6432Node`).
    Run32,
    StartupFolder,
    /// A Store app's `StartupTask` (its mark: the task's `State`, see `store_task.rs`).
    StoreTask,
}

/// Why an entry cannot be changed here.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Lock {
    /// For the whole PC (often drivers): needs administrator rights.
    Machine,
    /// Part of Windows.
    System,
    /// Kayro itself (its own switch is « Démarrer avec Windows »).
    Kayro,
}

/// One program as Windows lists it, before its mark is read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Source {
    pub scope: Scope,
    pub place: Place,
    /// The value's name (`Run`) or the file's name (Startup folder): also the mark's name.
    pub name: String,
    /// The command (`Run`) or the file's path (Startup folder).
    pub target: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    /// `scope:place:name`, stable between two lists.
    pub id: String,
    /// Shown to the user (a file's name without `.lnk`).
    pub name: String,
    pub target: String,
    pub scope: Scope,
    pub place: Place,
    pub enabled: bool,
    pub locked: Option<Lock>,
    /// Switched off by Kayro (in the journal): « Tout remettre » puts it back.
    pub by_kayro: bool,
}

/// What the entries live in: the registry, or a fake one in tests.
pub trait Store {
    fn sources(&self) -> Vec<Source>;
    fn mark(&self, scope: Scope, place: Place, name: &str) -> Option<Vec<u8>>;
    /// Writes the mark (`None` removes it). Only ever called for the user's entries.
    fn set_mark(&mut self, place: Place, name: &str, mark: Option<&[u8]>) -> io::Result<()>;
}

/// The mark the Task Manager writes when it switches an entry on.
pub const MARK_ON: [u8; 12] = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/// No mark, or an even first byte: Windows starts it.
pub fn is_on(mark: Option<&[u8]>) -> bool {
    mark.and_then(|m| m.first()).is_none_or(|b| b & 1 == 0)
}

fn on_at(place: Place, mark: Option<&[u8]>) -> bool {
    match place {
        Place::StoreTask => store_task::is_on(mark),
        _ => is_on(mark),
    }
}

/// What Windows' own switch writes to switch `place`'s entries on, or off.
fn mark_for(place: Place, on: bool) -> Vec<u8> {
    match (place, on) {
        (Place::StoreTask, true) => store_task::ON.to_vec(),
        (Place::StoreTask, false) => store_task::OFF.to_vec(),
        (_, true) => MARK_ON.to_vec(),
        (_, false) => mark_off(now()).to_vec(),
    }
}

/// The mark the Task Manager writes when it switches an entry off: `03` and the date (FILETIME).
pub fn mark_off(unix_seconds: u64) -> [u8; 12] {
    // FILETIME: 100 ns steps since 1601-01-01.
    let filetime = (unix_seconds + 11_644_473_600) * 10_000_000;
    let mut m = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    m[4..].copy_from_slice(&filetime.to_le_bytes());
    m
}

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

fn id_of(s: &Source) -> String {
    let scope = match s.scope {
        Scope::User => "user",
        Scope::Machine => "machine",
    };
    let place = match s.place {
        Place::Run => "run",
        Place::Run32 => "run32",
        Place::StartupFolder => "folder",
        Place::StoreTask => "store",
    };
    format!("{scope}:{place}:{}", s.name)
}

/// The program a command starts: `"C:\a b\x.exe" --y` → `C:\a b\x.exe`, `C:\x.exe -y` → `C:\x.exe`.
pub fn program_of(command: &str) -> String {
    let c = command.trim();
    if let Some(rest) = c.strip_prefix('"') {
        return rest.split('"').next().unwrap_or("").to_string();
    }
    let lower = c.to_lowercase();
    match lower.find(".exe") {
        Some(i) => c[..i + 4].to_string(),
        None => c.split_whitespace().next().unwrap_or("").to_string(),
    }
}

/// Windows' own programs at login, kept whatever their place.
const SYSTEM_NAMES: [&str; 4] = ["securityhealth", "ctfmon", "windowsdefender", "windows defender"];

/// Why `s` cannot be changed, if it cannot. `windows_dir`: `C:\Windows` (lower case).
pub fn lock_of(s: &Source, windows_dir: &str) -> Option<Lock> {
    if s.scope == Scope::Machine {
        return Some(Lock::Machine);
    }
    if s.place == Place::StoreTask {
        return store_task::is_windows(&s.name).then_some(Lock::System);
    }
    let program = program_of(&s.target).to_lowercase();
    let file = Path::new(&program)
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_default();
    let stem = display_name(s).to_lowercase();
    if stem == "kayro" || file == "kayro.exe" {
        return Some(Lock::Kayro);
    }
    let in_windows = !windows_dir.is_empty() && program.starts_with(windows_dir)
        || program.starts_with("%windir%")
        || program.starts_with("%systemroot%");
    if in_windows || SYSTEM_NAMES.contains(&stem.as_str()) {
        return Some(Lock::System);
    }
    None
}

/// `lock_of`, and a Store app's switch set by a policy (the PC's administrator).
fn lock_with(s: &Source, mark: Option<&[u8]>, windows_dir: &str) -> Option<Lock> {
    let policy = s.place == Place::StoreTask && store_task::by_policy(mark);
    lock_of(s, windows_dir).or(policy.then_some(Lock::Machine))
}

fn display_name(s: &Source) -> String {
    match s.place {
        Place::StoreTask => store_task::display_name(&s.name),
        Place::StartupFolder => Path::new(&s.name)
            .file_stem()
            .map_or_else(|| s.name.clone(), |f| f.to_string_lossy().into_owned()),
        _ => tidy_name(&s.name),
    }
}

/// A `Run` value's name made readable: `electron.app.Notion` → `Notion`,
/// `MicrosoftEdgeAutoLaunch_964C6E…` → `MicrosoftEdgeAutoLaunch`, `Updater145.2.7` → `Updater`.
pub fn tidy_name(name: &str) -> String {
    let n = name.strip_prefix("electron.app.").unwrap_or(name);
    let n = match n.rsplit_once('_') {
        Some((head, tail)) if tail.len() >= 16 && tail.chars().all(|c| c.is_ascii_hexdigit()) => head,
        _ => n,
    };
    let n = n.trim_end_matches(|c: char| c.is_ascii_digit() || c == '.');
    if n.is_empty() {
        name.to_string()
    } else {
        n.to_string()
    }
}

fn windows_dir() -> String {
    std::env::var("SystemRoot")
        .or_else(|_| std::env::var("windir"))
        .unwrap_or_default()
        .to_lowercase()
}

/// Every entry, the changeable ones first, then by name.
pub fn list(store: &impl Store, journal: &Journal) -> Vec<Entry> {
    list_in(store, journal, &windows_dir())
}

fn list_in(store: &impl Store, journal: &Journal, windows_dir: &str) -> Vec<Entry> {
    let mut entries: Vec<Entry> = store
        .sources()
        .into_iter()
        .map(|s| {
            let id = id_of(&s);
            let mark = store.mark(s.scope, s.place, &s.name);
            Entry {
                enabled: on_at(s.place, mark.as_deref()),
                locked: lock_with(&s, mark.as_deref(), windows_dir),
                by_kayro: journal.contains(&id),
                name: display_name(&s),
                target: s.target,
                scope: s.scope,
                place: s.place,
                id,
            }
        })
        .collect();
    entries.sort_by_key(|e| (e.locked.is_some(), e.name.to_lowercase()));
    entries
}

fn find(store: &impl Store, id: &str) -> io::Result<Source> {
    store
        .sources()
        .into_iter()
        .find(|s| id_of(s) == id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "startup entry not found"))
}

/// Switches one of the user's entries on or off. Off: its mark before is kept in the journal.
/// On: the journal's mark comes back (or Windows' « on » mark if Kayro did not switch it off).
pub fn set_enabled(store: &mut impl Store, journal: &mut Journal, id: &str, on: bool) -> io::Result<()> {
    let s = find(store, id)?;
    let mark = store.mark(s.scope, s.place, &s.name);
    if lock_with(&s, mark.as_deref(), &windows_dir()).is_some() {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "locked startup entry"));
    }
    let (place, name) = (s.place, s.name.as_str());
    if on {
        match journal.take(id) {
            Some(before) if on_at(place, before.as_deref()) => {
                store.set_mark(place, name, before.as_deref())?
            }
            _ if !on_at(place, mark.as_deref()) => {
                store.set_mark(place, name, Some(&mark_for(place, true)))?
            }
            _ => {}
        }
    } else if on_at(place, mark.as_deref()) {
        journal.record(id, mark);
        store.set_mark(place, name, Some(&mark_for(place, false)))?;
    }
    journal.save()
}

/// Switches off every changeable entry that is on and not in `keep` (« Garder seulement Kayro »:
/// `keep` empty). Returns how many were switched off.
pub fn keep_only(store: &mut impl Store, journal: &mut Journal, keep: &[String]) -> io::Result<usize> {
    let off: Vec<String> = list(store, journal)
        .into_iter()
        .filter(|e| e.enabled && e.locked.is_none() && !keep.contains(&e.id))
        .map(|e| e.id)
        .collect();
    for id in &off {
        set_enabled(store, journal, id, false)?;
    }
    Ok(off.len())
}

/// Puts back every mark Kayro changed, exactly as it was. Returns how many.
pub fn restore_all(store: &mut impl Store, journal: &mut Journal) -> io::Result<usize> {
    let all = journal.drain();
    for (id, before) in &all {
        // An entry whose program was uninstalled since: its mark goes back all the same.
        let (place, name) = place_and_name(id)?;
        store.set_mark(place, name, before.as_deref())?;
    }
    journal.save()?;
    Ok(all.len())
}

fn place_and_name(id: &str) -> io::Result<(Place, &str)> {
    let bad = || io::Error::new(io::ErrorKind::InvalidData, "bad startup id");
    let rest = id.strip_prefix("user:").ok_or_else(bad)?;
    let (place, name) = rest.split_once(':').ok_or_else(bad)?;
    let place = match place {
        "run" => Place::Run,
        "folder" => Place::StartupFolder,
        "store" => Place::StoreTask,
        _ => return Err(bad()),
    };
    Ok((place, name))
}
