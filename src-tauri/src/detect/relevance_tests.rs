use super::*;

fn c(name: &str, folder: Option<&str>, exe: &str) -> Candidate {
    Candidate {
        name: name.into(),
        folder: folder.map(Into::into),
        exe_stem: exe.into(),
    }
}

fn kept(list: &[Candidate]) -> Vec<String> {
    list.iter()
        .zip(keep_mask(list))
        .filter(|(_, k)| *k)
        .map(|(c, _)| c.name.clone())
        .collect()
}

#[test]
fn helpers_consoles_and_runtimes_go() {
    let list = [
        c("Check For Updates", Some("Java"), "jucheck"),
        c("About Java", Some("Java"), "javacpl"),
        c("Python 3.13 (64-bit)", Some("Python 3.13"), "python"),
        c(
            "Python 3.13 Module Docs (64-bit)",
            Some("Python 3.13"),
            "python",
        ),
        c("IDLE (Python 3.13 64-bit)", Some("Python 3.13"), "pythonw"),
        c("Git Bash", Some("Git"), "git-bash"),
        c("Node.js", Some("Node.js"), "node"),
        c(
            "Report a problem with Unity",
            Some("Unity"),
            "UnityBugReporter",
        ),
        c(
            "WorldPainter (safe mode)",
            Some("WorldPainter"),
            "worldpainter",
        ),
        c("Hue Sync (compatibility mode)", None, "HueSync"),
        c("BlueStacks Services", Some("BlueStacks"), "HD-Player"),
        c("Visual Studio Installer", None, "setup"),
        c("Windows App Cert Kit", None, "appcert"),
        c("Desktop Overlay Host", None, "overlay"),
        c("Gamakay Driver", None, "gamakay"),
        c("RivaTuner Statistics Server", None, "RTSS"),
        c("FL Cloud Plugins", Some("Image-Line"), "flcloud"),
        c("Mise à jour de Foo", None, "foo"),
    ];
    assert!(kept(&list).is_empty(), "{:?}", kept(&list));
}

#[test]
fn real_apps_stay() {
    let list = [
        c("OBS Studio", Some("OBS Studio"), "obs64"),
        c("Discord", Some("Discord Inc"), "Update"),
        c("Steam", Some("Steam"), "steam"),
        c(
            "CrystalDiskInfo Aoi Edition",
            Some("CrystalDiskInfo"),
            "DiskInfo64A",
        ),
        c("Idle Champions", None, "IdleDragons"),
        c("Hogwarts Legacy", None, "HogwartsLegacy"),
        c("WorldPainter", Some("WorldPainter"), "worldpainter"),
    ];
    assert_eq!(kept(&list).len(), list.len(), "{:?}", kept(&list));
}

#[test]
fn variants_and_repeats_go_when_the_base_app_is_there() {
    let list = [
        c("Dead Cells", None, "deadcells"),
        c("Dead Cells OpenGL", None, "deadcells_gl"),
        c("Discord", None, "Update"),
        c("Discord", None, "Discord"),
        c("Solo x64", None, "solo"),
    ];
    assert_eq!(kept(&list), ["Dead Cells", "Discord", "Solo x64"]);
}

#[test]
fn a_suite_keeps_the_shortcuts_that_carry_its_name() {
    let vm = Some("Voicemeeter");
    let list = [
        c("Voicemeeter", vm, "voicemeeter"),
        c("Voicemeeter x64", vm, "voicemeeter_x64"),
        c("Voicemeeter Banana", vm, "voicemeeterpro"),
        c("Macro Buttons", vm, "VoicemeeterMacroButtons"),
        c("8x8 Output Matrix", vm, "matrix"),
        c("VBAN 2 MIDI", vm, "vban2midi"),
    ];
    assert_eq!(kept(&list), ["Voicemeeter", "Voicemeeter Banana"]);

    let dv = Some("DaVinci Resolve");
    let list = [
        c("DaVinci Resolve", dv, "Resolve"),
        c("Blackmagic RAW Player", dv, "BlackmagicRawPlayer"),
        c("Fairlight Studio Utility", dv, "FairlightStudioUtility"),
    ];
    assert_eq!(kept(&list), ["DaVinci Resolve"]);
}

#[test]
fn a_folder_without_its_name_or_with_known_apps_keeps_them() {
    let riot = Some("Riot Games");
    let list = [
        c("Riot Client", riot, "RiotClientServices"),
        c("VALORANT", riot, "VALORANT"),
    ];
    assert_eq!(kept(&list), ["Riot Client", "VALORANT"]);

    let misc = Some("Utilitaires");
    let list = [c("Foo", misc, "foo"), c("Bar", misc, "bar")];
    assert_eq!(kept(&list), ["Foo", "Bar"]);
}

#[test]
fn copied_shortcuts_get_their_real_name_and_bracketed_twins_go() {
    assert_eq!(clean_name("spotify - Raccourci"), "Spotify");
    assert_eq!(clean_name("Foo - Shortcut"), "Foo");
    assert_eq!(clean_name("Blender 4.4"), "Blender 4.4");
    let list = [
        c("Voicemeeter", None, "voicemeeter"),
        c("Voicemeeter (VB-Audio)", None, "voicemeeter8"),
        c("OneDrive", None, "OneDrive"),
    ];
    assert_eq!(kept(&list), ["Voicemeeter"]);
}
