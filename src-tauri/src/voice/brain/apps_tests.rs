use super::*;

fn k<'a>(id: &'a str, name: &'a str) -> Known<'a> {
    Known {
        id,
        name,
        category: "autres",
        store_game: false,
        favorite: false,
    }
}

fn told(s: &Spoken) -> Vec<String> {
    s.apps.iter().map(|n| format!("{} = {}", n.id, n.name)).collect()
}

#[test]
fn copies_of_an_app_are_told_once() {
    let apps = [
        k("voicemeeter", "Voicemeeter"),
        k("voicemeeter-vb-audio", "Voicemeeter (VB-Audio)"),
        k("voicemeeter-banana-x64", "Voicemeeter Banana x64"),
        k("voicemeeter-x64", "Voicemeeter x64"),
        k("python-3-11-64-bit", "Python 3.11 (64-bit)"),
        k("python-3-13-64-bit", "Python 3.13 (64-bit)"),
        k("fl-studio-2024", "FL Studio 2024"),
        k("fl-studio-2026", "FL Studio 2026"),
        k("dead-cells", "Dead Cells"),
        k("dead-cells-opengl", "Dead Cells (OpenGL)"),
        k("roblox", "Roblox"),
        k("roblox-player", "Roblox Player"),
        k("roblox-studio", "Roblox Studio"),
    ];
    let s = spoken(&apps);
    assert_eq!(
        told(&s),
        [
            "voicemeeter = Voicemeeter (réglages audio)",
            "voicemeeter-banana-x64 = Voicemeeter Banana (réglages audio)",
            "python-3-13-64-bit = Python",
            "fl-studio-2026 = FL Studio (création musicale)",
            "dead-cells = Dead Cells",
            "roblox = Roblox",
            "roblox-studio = Roblox Studio",
        ]
    );
    assert_eq!(s.represent("voicemeeter-x64"), Some("voicemeeter"));
    assert_eq!(s.represent("roblox-player"), Some("roblox"));
    assert_eq!(
        s.members("voicemeeter"),
        ["voicemeeter", "voicemeeter-vb-audio", "voicemeeter-x64"]
    );
    assert_eq!(s.members("unknown"), ["unknown"]);
}

#[test]
fn games_are_never_grouped_and_utilities_are_left_out() {
    let game = |id, name| Known {
        store_game: true,
        category: "jeux",
        ..k(id, name)
    };
    let apps = [
        game("slay-the-spire", "Slay the Spire"),
        game("slay-the-spire-2", "Slay the Spire 2"),
        k("check-for-updates", "Check For Updates"),
        k("python-3-13-module-docs-64-bit", "Python 3.13 Module Docs (64-bit)"),
        k("blender-4-4", "Blender 4.4"),
    ];
    assert_eq!(
        told(&spoken(&apps)),
        [
            "slay-the-spire = Slay the Spire (jeu)",
            "slay-the-spire-2 = Slay the Spire 2 (jeu)",
            "blender-4-4 = Blender 4.4 (3D)",
        ]
    );
}

#[test]
fn each_app_says_what_it_is_and_favourites_come_first() {
    let apps = [
        k("obsidian", "Obsidian"),
        k("obs-studio", "OBS Studio"),
        k("microsoft-edge", "Microsoft Edge"),
        Known {
            favorite: true,
            ..k("comet", "Comet")
        },
        k("crystaldiskinfo", "CrystalDiskInfo Aoi Edition"),
    ];
    assert_eq!(
        told(&spoken(&apps)),
        [
            "comet = Comet (navigateur)",
            "obsidian = Obsidian (notes)",
            "obs-studio = OBS Studio (stream et enregistrement de l'écran)",
            "microsoft-edge = Microsoft Edge (navigateur)",
            "crystaldiskinfo = CrystalDiskInfo Aoi Edition (matériel et surveillance du PC)",
        ]
    );
}
