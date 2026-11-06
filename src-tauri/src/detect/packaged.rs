//! Packaged apps (MSIX / Microsoft Store: Claude, Spotify, WhatsApp, Xbox games…) have no `.lnk`
//! in the Start Menu folders: the Start Menu shows them from the Shell's virtual `shell:AppsFolder`,
//! where each one has an AUMID (`PackageFamilyName!AppId`). Kayro launches them by that AUMID
//! (`Launch::Uwp`) and watches the program the package's manifest names.
//!
//! Left out: Windows' own apps (Settings, Calculator, Photos…), like the shortcuts under
//! `C:\Windows`; entries that are not packages (desktop programs, `steam://` links), which the
//! `.lnk` scan and the stores already provide; a package with the name of a shortcut already found.

use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use windows::core::{Interface, HSTRING, PCWSTR, PWSTR};
use windows::Win32::Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS};
use windows::Win32::Storage::EnhancedStorage::PKEY_AppUserModel_ID;
use windows::Win32::Storage::Packaging::Appx::{
    GetPackagePathByFullName, GetPackagesByPackageFamily,
};
use windows::Win32::System::Com::{CoTaskMemFree, IBindCtx};
use windows::Win32::UI::Shell::{
    BHID_EnumItems, FOLDERID_AppsFolder, IEnumShellItems, IShellItem, IShellItem2,
    SHGetKnownFolderItem, KF_FLAG_DEFAULT, SIGDN_NORMALDISPLAY,
};

use super::category::normalise;
use super::relevance::clean_name;
use super::{short_hash, DetectedApp, ScanCtx, SourceKind};
use crate::config::apps::{AppSource, Launch, MatchRule};

const MAX_ITEMS: usize = 5000;
const MAX_MANIFEST_BYTES: u64 = 2 * 1024 * 1024;

/// Publisher id of the packages that are part of Windows itself (Settings, Get Started…).
const WINDOWS_PUBLISHER: &str = "cw5n1h2txyewy";

/// Microsoft's apps shipped with Windows (package names, lower case): tools, rarely what one
/// launches from Kayro. Teams, Terminal, Xbox, the Store, OneNote or Minecraft stay proposed.
const WINDOWS_TOOLS: &[&str] = &[
    "microsoft.windowscalculator",
    "microsoft.windowsnotepad",
    "microsoft.screensketch",
    "microsoft.sechealthui",
    "microsoft.mixedreality.portal",
    "microsoft.xboxgamingoverlay",
    "microsoft.windowsalarms",
    "microsoft.windowscamera",
    "microsoft.windowsmaps",
    "microsoft.windowssoundrecorder",
    "microsoft.windowsfeedbackhub",
    "microsoft.paint",
    "microsoft.microsoftstickynotes",
    "microsoft.gethelp",
    "microsoft.getstarted",
    "microsoft.people",
    "microsoft.bingweather",
    "microsoft.bingnews",
    "microsoft.bingsearch",
    "microsoft.yourphone",
    "microsoft.zunevideo",
    "microsoft.zunemusic",
    "microsoft.powerautomatedesktop",
    "microsoft.microsoftofficehub",
    "microsoft.windowscommunicationsapps",
    "microsoft.549981c3f5f10",
    "microsoftcorporationii.microsoftfamily",
    "microsoftcorporationii.quickassist",
    "microsoftcorporationii.windowshdrcalibration",
];

/// Programs that only start the real one and quit (`GameLaunchHelper`, `SpotifyMigrator`…):
/// watching them would tell that the app closed.
const STARTER_MARKERS: [&str; 5] = ["launch", "migrator", "helper", "stub", "bootstrap"];

/// One entry of `shell:AppsFolder` that is a package's app.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Packaged {
    pub aumid: String,
    pub name: String,
}

/// `PackageFamilyName!AppId` as (package name, publisher id, app id); `None` for an AUMID that
/// is not a package's (a desktop program's own id, a `steam://` link…).
pub(crate) fn split_aumid(aumid: &str) -> Option<(&str, &str, &str)> {
    let (family, app) = aumid.split_once('!')?;
    let (name, publisher) = family.rsplit_once('_')?;
    let publisher_like = publisher.len() == 13
        && publisher
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit());
    (publisher_like && !name.is_empty() && !app.is_empty()).then_some((name, publisher, app))
}

/// One of Windows' own apps (Settings, Calculator, Photos, Windows Security…)?
pub(crate) fn is_windows_app(package: &str, publisher: &str) -> bool {
    let p = package.to_lowercase();
    publisher == WINDOWS_PUBLISHER
        || p.starts_with("microsoft.windows.")
        || p.starts_with("microsoftwindows.")
        || WINDOWS_TOOLS.contains(&p.as_str())
}

/// The value of attribute `key` in the start tag `tag` (either quote).
fn attr<'a>(tag: &'a str, key: &str) -> Option<&'a str> {
    let mut from = 0;
    while let Some(i) = tag[from..].find(key).map(|i| i + from) {
        from = i + key.len();
        if !tag[..i].ends_with(char::is_whitespace) {
            continue; // `HostId=` is not `Id=`
        }
        let Some(value) = tag[from..].trim_start().strip_prefix('=') else {
            continue;
        };
        let value = value.trim_start();
        let quote = value.chars().next().filter(|q| *q == '"' || *q == '\'')?;
        let body = &value[1..];
        return body.find(quote).map(|end| &body[..end]);
    }
    None
}

/// The `<Application …>` start tag of `app_id` in a package's `AppxManifest.xml`.
fn application_tag<'a>(manifest: &'a str, app_id: &str) -> Option<&'a str> {
    manifest.match_indices("<Application").find_map(|(i, _)| {
        let rest = &manifest[i + "<Application".len()..];
        if !rest.starts_with(char::is_whitespace) {
            return None; // `<Applications>`
        }
        let tag = &rest[..rest.find('>')?];
        attr(tag, "Id")
            .is_some_and(|id| id.eq_ignore_ascii_case(app_id))
            .then_some(tag)
    })
}

/// The program `app_id` runs, from the package's `AppxManifest.xml` (`Executable`). `None` when
/// the manifest does not say, or names only a starter (see `STARTER_MARKERS`).
pub(crate) fn manifest_exe(manifest: &str, app_id: &str) -> Option<String> {
    let tag = application_tag(manifest, app_id)?;
    let exe = attr(tag, "Executable")?.rsplit(['\\', '/']).next()?;
    let lower = exe.to_lowercase();
    let stem = lower.strip_suffix(".exe")?;
    let starter = STARTER_MARKERS.iter().any(|m| stem.contains(m));
    (!stem.is_empty() && !lower.contains('$') && !starter).then(|| exe.to_string())
}

/// A string the Shell allocated, copied then freed. `p` must come from the Shell.
unsafe fn take(p: PWSTR) -> Option<String> {
    if p.is_null() {
        return None;
    }
    // SAFETY: `p` is a valid, NUL-terminated string allocated by COM (caller's contract).
    let text = unsafe { p.to_string() }.ok();
    unsafe { CoTaskMemFree(Some(p.0 as *const _)) };
    text.filter(|t| !t.is_empty())
}

/// Every package app `shell:AppsFolder` lists (what the Start Menu shows). Needs COM on the
/// calling thread.
pub(crate) fn list(ctx: &ScanCtx) -> Result<Vec<Packaged>, String> {
    // SAFETY: COM calls on interfaces obtained just above; strings from the Shell go to `take`.
    unsafe {
        let folder: IShellItem = SHGetKnownFolderItem(&FOLDERID_AppsFolder, KF_FLAG_DEFAULT, None)
            .map_err(|e| e.to_string())?;
        let items: IEnumShellItems = folder
            .BindToHandler(None::<&IBindCtx>, &BHID_EnumItems)
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        while out.len() < MAX_ITEMS && !ctx.cancelled() {
            let mut slot = [None];
            let mut fetched = 0u32;
            if items.Next(&mut slot, Some(&mut fetched)).is_err() || fetched == 0 {
                break;
            }
            let Some(item) = slot[0].take() else {
                break;
            };
            let Ok(item2) = item.cast::<IShellItem2>() else {
                continue;
            };
            let Some(aumid) = item2
                .GetString(&PKEY_AppUserModel_ID)
                .ok()
                .and_then(|p| take(p))
            else {
                continue;
            };
            if split_aumid(&aumid).is_none() {
                continue;
            }
            if let Some(name) = item
                .GetDisplayName(SIGDN_NORMALDISPLAY)
                .ok()
                .and_then(|p| take(p))
            {
                out.push(Packaged { aumid, name });
            }
        }
        Ok(out)
    }
}

fn wide_to_path(buf: &[u16]) -> PathBuf {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    PathBuf::from(String::from_utf16_lossy(&buf[..len]))
}

/// The folder of a package, by its full name.
fn path_of(full_name: PCWSTR) -> Option<PathBuf> {
    let mut len = 0u32;
    // SAFETY: the size is asked first with no buffer, then a buffer of exactly that size is given.
    unsafe {
        if GetPackagePathByFullName(full_name, &mut len, None) != ERROR_INSUFFICIENT_BUFFER {
            return None;
        }
        let mut buf = vec![0u16; len as usize];
        if GetPackagePathByFullName(full_name, &mut len, Some(PWSTR(buf.as_mut_ptr())))
            != ERROR_SUCCESS
        {
            return None;
        }
        Some(wide_to_path(&buf))
    }
}

/// The folders of the installed packages of `family` (usually one).
pub(crate) fn package_dirs(family: &str) -> Vec<PathBuf> {
    let family = HSTRING::from(family);
    let (mut count, mut len) = (0u32, 0u32);
    // SAFETY: sizes asked first with no buffers, then buffers of exactly those sizes; the names
    // point into `buf`, which outlives their use.
    unsafe {
        if GetPackagesByPackageFamily(&family, &mut count, None, &mut len, None)
            != ERROR_INSUFFICIENT_BUFFER
        {
            return Vec::new();
        }
        let mut names = vec![PWSTR::null(); count as usize];
        let mut buf = vec![0u16; len as usize];
        let filled = GetPackagesByPackageFamily(
            &family,
            &mut count,
            Some(names.as_mut_ptr()),
            &mut len,
            Some(PWSTR(buf.as_mut_ptr())),
        );
        if filled != ERROR_SUCCESS {
            return Vec::new();
        }
        names
            .iter()
            .take(count as usize)
            .filter_map(|n| path_of(PCWSTR(n.0)))
            .collect()
    }
}

/// The program `app_id` of the package family `family` runs (see `manifest_exe`).
fn program_of(family: &str, app_id: &str) -> Option<String> {
    package_dirs(family).iter().find_map(|dir| {
        let file = dir.join("AppxManifest.xml");
        let small = fs::metadata(&file).is_ok_and(|m| m.len() <= MAX_MANIFEST_BYTES);
        let text = small.then(|| fs::read_to_string(&file).ok()).flatten()?;
        manifest_exe(&text, app_id)
    })
}

/// Proposals for the packaged apps; `shortcuts` are the Start Menu apps already found.
pub(crate) fn to_apps(
    items: Vec<Packaged>,
    shortcuts: &[DetectedApp],
    ctx: &ScanCtx,
) -> Vec<DetectedApp> {
    let mut names: HashSet<String> = shortcuts.iter().map(|a| normalise(&a.name)).collect();
    let mut apps = Vec::new();
    for item in items {
        if ctx.cancelled() {
            break;
        }
        let Some((package, publisher, app_id)) = split_aumid(&item.aumid) else {
            continue;
        };
        if is_windows_app(package, publisher) {
            ctx.skip(&item.name, "Windows' own app");
            continue;
        }
        let name = clean_name(&item.name);
        if !names.insert(normalise(&name)) {
            ctx.skip(&item.name, "same name as a shortcut");
            continue;
        }
        let family = item.aumid.split_once('!').map_or("", |(f, _)| f);
        let exe = program_of(family, app_id);
        let app = DetectedApp {
            id: format!(
                "menu-{}",
                short_hash(&format!("uwp:{}", item.aumid.to_lowercase()))
            ),
            name,
            source: AppSource::Startmenu,
            launch: Launch::Uwp {
                aumid: item.aumid.clone(),
            },
            match_rule: MatchRule { exe },
            poster_path: None,
            hero_path: None,
            already_added: false,
            suggested_category: String::new(),
            launcher: false,
            ignored: false,
            // No folder: the advanced scan would look there for a logo and take a tile image made
            // for a coloured plate; the Shell's icon of the app is the right one.
            install_dir: None,
            logo_path: None,
        };
        apps.extend(ctx.accept(SourceKind::Startmenu, app));
    }
    apps
}

#[cfg(test)]
#[path = "packaged_tests.rs"]
mod tests;
