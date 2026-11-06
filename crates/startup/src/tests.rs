use std::collections::HashMap;

use super::*;

/// A registry in memory: the sources and the marks of the user's hive.
#[derive(Default)]
struct Fake {
    sources: Vec<Source>,
    marks: HashMap<(Place, String), Vec<u8>>,
    machine_marks: HashMap<(Place, String), Vec<u8>>,
}

impl Store for Fake {
    fn sources(&self) -> Vec<Source> {
        self.sources.clone()
    }
    fn mark(&self, scope: Scope, place: Place, name: &str) -> Option<Vec<u8>> {
        let marks = match scope {
            Scope::User => &self.marks,
            Scope::Machine => &self.machine_marks,
        };
        marks.get(&(place, name.to_string())).cloned()
    }
    fn set_mark(&mut self, place: Place, name: &str, mark: Option<&[u8]>) -> io::Result<()> {
        match mark {
            Some(m) => self.marks.insert((place, name.to_string()), m.to_vec()),
            None => self.marks.remove(&(place, name.to_string())),
        };
        Ok(())
    }
}

fn src(scope: Scope, place: Place, name: &str, target: &str) -> Source {
    Source {
        scope,
        place,
        name: name.into(),
        target: target.into(),
    }
}

fn pc() -> Fake {
    Fake {
        sources: vec![
            src(Scope::User, Place::Run, "Discord", r#""C:\U\Discord\Update.exe" --processStart Discord.exe"#),
            src(Scope::User, Place::Run, "Steam", r#""C:\Program Files (x86)\Steam\steam.exe" -silent"#),
            src(Scope::User, Place::Run, "Kayro", r#""C:\U\Local\Kayro\Kayro.exe" --silent"#),
            src(Scope::User, Place::StartupFolder, "Notes.lnk", r"C:\U\Startup\Notes.lnk"),
            src(Scope::Machine, Place::Run, "RtkAudUService", r#""C:\Windows\System32\RtkAudUService64.exe" -background"#),
        ],
        ..Fake::default()
    }
}

fn journal() -> (tempfile::TempDir, Journal) {
    let dir = tempfile::tempdir().unwrap();
    let j = Journal::load(dir.path());
    (dir, j)
}

#[test]
fn marks_read_like_the_task_manager() {
    assert!(is_on(None));
    assert!(is_on(Some(&MARK_ON)));
    assert!(is_on(Some(&[6, 0, 0, 0])));
    assert!(!is_on(Some(&[3, 0, 0, 0])));
    assert!(!is_on(Some(&[1, 0, 0, 0])));
    let off = mark_off(0);
    assert_eq!(off[0], 3);
    // 1970-01-01 as a FILETIME.
    assert_eq!(u64::from_le_bytes(off[4..].try_into().unwrap()), 116_444_736_000_000_000);
}

#[test]
fn the_program_of_a_command() {
    assert_eq!(program_of(r#""C:\a b\x.exe" --y"#), r"C:\a b\x.exe");
    assert_eq!(program_of(r"C:\a\x.EXE -y"), r"C:\a\x.EXE");
    assert_eq!(program_of("rundll32 a,b"), "rundll32");
}

#[test]
fn the_machines_windows_and_kayro_are_never_changed() {
    let (_d, j) = journal();
    let list = list_in(&pc(), &j, r"c:\windows");
    let lock = |name: &str| list.iter().find(|e| e.name == name).unwrap().locked;
    assert_eq!(lock("Discord"), None);
    assert_eq!(lock("Notes"), None);
    assert_eq!(lock("Kayro"), Some(Lock::Kayro));
    assert_eq!(lock("RtkAudUService"), Some(Lock::Machine));
    let sys = src(Scope::User, Place::Run, "Thing", r"%windir%\system32\thing.exe");
    assert_eq!(lock_of(&sys, r"c:\windows"), Some(Lock::System));
    let sys = src(Scope::User, Place::Run, "Other", r"C:\WINDOWS\x.exe");
    assert_eq!(lock_of(&sys, r"c:\windows"), Some(Lock::System));
    let health = src(Scope::User, Place::Run, "SecurityHealth", r"C:\P\x.exe");
    assert_eq!(lock_of(&health, r"c:\windows"), Some(Lock::System));
    // Changeable first, then by name.
    let names: Vec<_> = list.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, ["Discord", "Notes", "Steam", "Kayro", "RtkAudUService"]);
}

#[test]
fn keep_only_kayro_switches_the_others_off_and_puts_them_back_exactly() {
    let mut pc = pc();
    // Steam had a mark before (switched on again by hand once): it must come back as it was.
    pc.marks.insert((Place::Run, "Steam".into()), vec![6, 0, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9]);
    let before = pc.marks.clone();
    let (dir, mut j) = journal();
    assert_eq!(keep_only(&mut pc, &mut j, &[]).unwrap(), 3);
    let list = list(&pc, &j);
    let on = |name: &str| list.iter().find(|e| e.name == name).unwrap().enabled;
    assert!(!on("Discord") && !on("Steam") && !on("Notes"));
    assert!(on("Kayro") && on("RtkAudUService"));
    assert!(list.iter().find(|e| e.name == "Discord").unwrap().by_kayro);
    // The journal survives a restart of the program.
    let mut j = Journal::load(dir.path());
    assert_eq!(restore_all(&mut pc, &mut j).unwrap(), 3);
    assert_eq!(pc.marks, before);
    assert!(Journal::load(dir.path()).is_empty());
}

#[test]
fn keep_keeps_the_ticked_ones() {
    let mut pc = pc();
    let (_d, mut j) = journal();
    keep_only(&mut pc, &mut j, &["user:run:Steam".into()]).unwrap();
    assert!(is_on(pc.mark(Scope::User, Place::Run, "Steam").as_deref()));
    assert!(!is_on(pc.mark(Scope::User, Place::Run, "Discord").as_deref()));
}

#[test]
fn one_switch_at_a_time() {
    let mut pc = pc();
    let (_d, mut j) = journal();
    set_enabled(&mut pc, &mut j, "user:folder:Notes.lnk", false).unwrap();
    assert!(j.contains("user:folder:Notes.lnk"));
    // Off twice: the mark from before Kayro is the one kept.
    set_enabled(&mut pc, &mut j, "user:folder:Notes.lnk", false).unwrap();
    set_enabled(&mut pc, &mut j, "user:folder:Notes.lnk", true).unwrap();
    assert_eq!(pc.marks.get(&(Place::StartupFolder, "Notes.lnk".into())), None);
    assert!(j.is_empty());
    // Switched off by someone else: Kayro switches it on with Windows' own mark.
    pc.marks.insert((Place::Run, "Steam".into()), mark_off(5).to_vec());
    set_enabled(&mut pc, &mut j, "user:run:Steam", true).unwrap();
    assert_eq!(pc.marks[&(Place::Run, "Steam".into())], MARK_ON);
    // Locked ones refuse.
    let err = set_enabled(&mut pc, &mut j, "user:run:Kayro", false).unwrap_err();
    assert_eq!(err.kind(), io::ErrorKind::PermissionDenied);
    assert!(set_enabled(&mut pc, &mut j, "machine:run:RtkAudUService", false).is_err());
}

/// Manual probe, read only: `cargo test -p kayro-startup -- --ignored --nocapture probe`.
#[cfg(windows)]
#[test]
#[ignore]
fn probe_this_pc() {
    let dir = tempfile::tempdir().unwrap();
    for e in list(&Registry, &Journal::load(dir.path())) {
        println!("{:<40} on={} lock={:?} {}", e.id, e.enabled, e.locked, e.target);
    }
}

#[test]
fn run_names_are_made_readable() {
    assert_eq!(tidy_name("electron.app.Notion"), "Notion");
    assert_eq!(tidy_name("MicrosoftEdgeAutoLaunch_964C6E9D0993DF3A6065A4B55F36E5BB"), "MicrosoftEdgeAutoLaunch");
    assert_eq!(tidy_name("CometUpdaterTaskUser145.2.7632.4583"), "CometUpdaterTaskUser");
    assert_eq!(tidy_name("NVIDIA Broadcast"), "NVIDIA Broadcast");
    assert_eq!(tidy_name("7zip_x"), "7zip_x");
    assert_eq!(tidy_name("123"), "123");
}

#[test]
fn store_apps_use_their_own_switch_and_come_back() {
    let wa = r"5319275A.WhatsAppDesktop_cv1g1gvanyjgm\2defd21c";
    let link = r"MicrosoftWindows.CrossDevice_cw5n1h2txyewy\CrossDevice.Start";
    let corp = r"Contoso.Tool_abc\Start";
    let term = r"Microsoft.WindowsTerminal_8wekyb3d8bbwe\StartTerminalOnLoginTask";
    let mut pc = Fake::default();
    for (name, state) in [(wa, 2u8), (link, 2), (corp, 4), (term, 0)] {
        let package = name.split('\\').next().unwrap();
        pc.sources.push(src(Scope::User, Place::StoreTask, name, package));
        pc.marks.insert((Place::StoreTask, name.into()), vec![state, 0, 0, 0]);
    }
    let (_d, mut j) = journal();
    let list = list(&pc, &j);
    let get = |id: &str| list.iter().find(|e| e.id == format!("user:store:{id}")).unwrap().clone();
    assert_eq!(get(wa).name, "WhatsAppDesktop");
    assert!(get(wa).enabled && get(wa).locked.is_none());
    assert_eq!(get(link).locked, Some(Lock::System)); // part of Windows
    assert_eq!(get(corp).locked, Some(Lock::Machine)); // set by a policy
    assert!(!get(term).enabled); // never switched on
    // « Garder seulement Kayro »: only WhatsApp goes off, as Windows' own switch does it.
    assert_eq!(keep_only(&mut pc, &mut j, &[]).unwrap(), 1);
    assert_eq!(pc.marks[&(Place::StoreTask, wa.into())], [1, 0, 0, 0]);
    restore_all(&mut pc, &mut j).unwrap();
    assert_eq!(pc.marks[&(Place::StoreTask, wa.into())], [2, 0, 0, 0]);
    // Switched on by hand from Kayro: Windows' « on ».
    set_enabled(&mut pc, &mut j, &format!("user:store:{term}"), true).unwrap();
    assert_eq!(pc.marks[&(Place::StoreTask, term.into())], [2, 0, 0, 0]);
}
