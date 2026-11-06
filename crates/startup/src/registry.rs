//! The real store: the `Run` keys, the Startup folders and their marks in the registry.

use std::io;
use std::path::PathBuf;

use windows::core::{HSTRING, PWSTR};
use windows::Win32::Foundation::ERROR_FILE_NOT_FOUND;
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteKeyValueW, RegEnumKeyExW, RegEnumValueW, RegGetValueW, RegOpenKeyExW,
    RegSetKeyValueW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, REG_BINARY, REG_DWORD,
    REG_EXPAND_SZ, REG_ROUTINE_FLAGS, REG_SZ, RRF_RT_REG_BINARY, RRF_RT_REG_DWORD,
};

use crate::{Place, Scope, Source, Store};

const RUN: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const RUN32: &str = "Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run";
const APPROVED: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved";
const STARTUP_DIR: &str = "Microsoft\\Windows\\Start Menu\\Programs\\Startup";
/// Store apps: one key per package, one sub-key per `StartupTask` with its `State`.
const APP_DATA: &str = "Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\SystemAppData";

pub struct Registry;

fn hive(scope: Scope) -> HKEY {
    match scope {
        Scope::User => HKEY_CURRENT_USER,
        Scope::Machine => HKEY_LOCAL_MACHINE,
    }
}

fn approved_key(place: Place) -> String {
    let sub = match place {
        Place::Run => "Run",
        Place::Run32 => "Run32",
        Place::StartupFolder => "StartupFolder",
        Place::StoreTask => return APP_DATA.to_string(),
    };
    format!("{APPROVED}\\{sub}")
}

/// The names of `key`'s sub-keys (user's hive). Missing key = none.
fn sub_keys(key: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut h = HKEY::default();
    // SAFETY: `h` is only used once opened, and closed below.
    let opened =
        unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, &HSTRING::from(key), None, KEY_READ, &mut h) };
    if opened.is_err() {
        return out;
    }
    let mut name = vec![0u16; 512];
    for i in 0.. {
        let mut len = name.len() as u32;
        // SAFETY: `name` outlives the call; `len` is its size in characters.
        let status = unsafe {
            RegEnumKeyExW(h, i, Some(PWSTR(name.as_mut_ptr())), &mut len, None, None, None, None)
        };
        if status.is_err() {
            break; // ERROR_NO_MORE_ITEMS
        }
        out.push(String::from_utf16_lossy(&name[..len as usize]));
    }
    // SAFETY: opened above.
    let _ = unsafe { RegCloseKey(h) };
    out
}

/// The Store apps' startup tasks of this account (those Windows keeps a `State` for).
fn store_tasks(store: &Registry) -> Vec<Source> {
    let mut out = Vec::new();
    for package in sub_keys(APP_DATA) {
        for task in sub_keys(&format!("{APP_DATA}\\{package}")) {
            let name = format!("{package}\\{task}");
            if store.mark(Scope::User, Place::StoreTask, &name).is_some() {
                out.push(Source {
                    scope: Scope::User,
                    place: Place::StoreTask,
                    target: package.clone(),
                    name,
                });
            }
        }
    }
    out
}

/// One value of the registry, as bytes (`flags`: the types accepted).
fn read(scope: Scope, key: &str, value: &str, flags: REG_ROUTINE_FLAGS) -> Option<Vec<u8>> {
    let mut buf = [0u8; 64];
    let mut len = buf.len() as u32;
    // SAFETY: the strings and `buf` outlive the call; `len` is the buffer's size in bytes.
    let status = unsafe {
        RegGetValueW(
            hive(scope),
            &HSTRING::from(key),
            &HSTRING::from(value),
            flags,
            None,
            Some(buf.as_mut_ptr().cast()),
            Some(&mut len),
        )
    };
    status.is_ok().then(|| buf[..len as usize].to_vec())
}

/// A Store app's task: its `State` (never removed: a task always has one).
fn set_store_state(name: &str, mark: Option<&[u8]>) -> io::Result<()> {
    let Some(m) = mark.filter(|m| m.len() == 4) else {
        return Ok(());
    };
    let key = HSTRING::from(format!("{APP_DATA}\\{name}"));
    // SAFETY: the strings and `m` outlive the call; only the user's hive is written.
    let status = unsafe {
        RegSetKeyValueW(
            HKEY_CURRENT_USER,
            &key,
            &HSTRING::from("State"),
            REG_DWORD.0,
            Some(m.as_ptr().cast()),
            4,
        )
    };
    if status.is_ok() {
        Ok(())
    } else {
        Err(io::Error::from_raw_os_error(status.0 as i32))
    }
}

/// The text values of `key` (`Run`): name and command. Missing key = none.
fn run_values(scope: Scope, key: &str, place: Place) -> Vec<Source> {
    let mut out = Vec::new();
    let mut h = HKEY::default();
    // SAFETY: `h` is only used once opened, and closed below.
    if unsafe { RegOpenKeyExW(hive(scope), &HSTRING::from(key), None, KEY_READ, &mut h) }.is_err() {
        return out;
    }
    let mut name = vec![0u16; 16_384];
    let mut data = vec![0u8; 65_536];
    for i in 0.. {
        let mut name_len = name.len() as u32;
        let mut data_len = data.len() as u32;
        let mut kind = 0u32;
        // SAFETY: the buffers outlive the call; the lengths are their sizes (chars / bytes).
        let status = unsafe {
            RegEnumValueW(
                h,
                i,
                Some(PWSTR(name.as_mut_ptr())),
                &mut name_len,
                None,
                Some(&mut kind),
                Some(data.as_mut_ptr()),
                Some(&mut data_len),
            )
        };
        if status.0 == 259 {
            break; // ERROR_NO_MORE_ITEMS
        }
        if status.is_err() || (kind != REG_SZ.0 && kind != REG_EXPAND_SZ.0) {
            continue; // too long, or not a command
        }
        let words: Vec<u16> = data[..data_len as usize]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&c| u16::from_le_bytes(c))
            .take_while(|&w| w != 0)
            .collect();
        out.push(Source {
            scope,
            place,
            name: String::from_utf16_lossy(&name[..name_len as usize]),
            target: String::from_utf16_lossy(&words),
        });
    }
    // SAFETY: opened above.
    let _ = unsafe { RegCloseKey(h) };
    out
}

/// The files of a Startup folder (`desktop.ini` aside).
fn folder_files(scope: Scope, dir: Option<PathBuf>) -> Vec<Source> {
    let Some(Ok(read)) = dir.map(std::fs::read_dir) else {
        return Vec::new();
    };
    read.flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .filter(|e| !e.file_name().eq_ignore_ascii_case("desktop.ini"))
        .map(|e| Source {
            scope,
            place: Place::StartupFolder,
            name: e.file_name().to_string_lossy().into_owned(),
            target: e.path().to_string_lossy().into_owned(),
        })
        .collect()
}

fn env_dir(var: &str) -> Option<PathBuf> {
    std::env::var_os(var).map(|d| PathBuf::from(d).join(STARTUP_DIR))
}

impl Store for Registry {
    fn sources(&self) -> Vec<Source> {
        let mut all = run_values(Scope::User, RUN, Place::Run);
        all.extend(folder_files(Scope::User, env_dir("APPDATA")));
        all.extend(store_tasks(self));
        all.extend(run_values(Scope::Machine, RUN, Place::Run));
        all.extend(run_values(Scope::Machine, RUN32, Place::Run32));
        all.extend(folder_files(Scope::Machine, env_dir("ProgramData")));
        all
    }

    fn mark(&self, scope: Scope, place: Place, name: &str) -> Option<Vec<u8>> {
        match place {
            Place::StoreTask => {
                read(scope, &format!("{APP_DATA}\\{name}"), "State", RRF_RT_REG_DWORD)
            }
            _ => read(scope, &approved_key(place), name, RRF_RT_REG_BINARY),
        }
    }

    fn set_mark(&mut self, place: Place, name: &str, mark: Option<&[u8]>) -> io::Result<()> {
        if place == Place::StoreTask {
            return set_store_state(name, mark);
        }
        let key = HSTRING::from(approved_key(place));
        let value = HSTRING::from(name);
        // SAFETY: the strings and `mark` outlive the calls; only the user's hive is written.
        let status = unsafe {
            match mark {
                Some(m) => RegSetKeyValueW(
                    HKEY_CURRENT_USER,
                    &key,
                    &value,
                    REG_BINARY.0,
                    Some(m.as_ptr().cast()),
                    m.len() as u32,
                ),
                None => RegDeleteKeyValueW(HKEY_CURRENT_USER, &key, &value),
            }
        };
        if status.is_ok() || (mark.is_none() && status == ERROR_FILE_NOT_FOUND) {
            Ok(())
        } else {
            Err(io::Error::from_raw_os_error(status.0 as i32))
        }
    }
}
