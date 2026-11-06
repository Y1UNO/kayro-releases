//! How the user may really say it (2026-11-04): polite, indirect, familiar French, with app names
//! like the user's (127 apps, several alike). The rules must get them; what they miss tells
//! whether a model of meaning (embeddings) would be worth it (CLAUDE.md: only when measured
//! better than the classic way).

use super::*;
use crate::voice::calib::key;

fn n(id: &str, name: &str) -> Named {
    Named {
        id: id.into(),
        name: name.into(),
    }
}

fn apps() -> Vec<Named> {
    [
        ("discord", "Discord"),
        ("steam", "Steam"),
        ("spotify", "Spotify"),
        ("hades", "Hades II"),
        ("apex", "Apex Legends"),
        ("forza", "Forza Horizon 6"),
        ("valorant", "VALORANT"),
        ("minecraft", "Minecraft Launcher"),
        ("roblox", "Roblox"),
        ("roblox-player", "Roblox Player"),
        ("roblox-studio", "Roblox Studio"),
        ("py311", "Python 3.11 (64-bit)"),
        ("py313", "Python 3.13 (64-bit)"),
        ("vm", "Voicemeeter"),
        ("vm-banana", "Voicemeeter Banana x64"),
        ("e33", "Clair Obscur: Expedition 33"),
        ("sts2", "Slay the Spire 2"),
        ("blender", "Blender 4.4"),
        ("audacity", "Audacity"),
        ("obs", "OBS Studio"),
        ("fl", "FL Studio 2026"),
        ("vscode", "Visual Studio Code"),
        ("wallpaper", "Wallpaper Engine"),
        ("epic", "Epic Games Launcher"),
        ("overwatch", "Overwatch®"),
        ("lossless", "Lossless Scaling"),
    ]
    .into_iter()
    .map(|(id, name)| n(id, name))
    .collect()
}

/// (what is said after the wake word, what it must do)
const CASES: &[(&str, &str)] = &[
    // Launching, the plain way.
    ("ouvre Discord", "app:discord"),
    ("lance Steam", "app:steam"),
    ("démarre Forza", "app:forza"),
    ("mets Spotify", "app:spotify"),
    ("lance Clair Obscur", "app:e33"),
    ("lance Slay the Spire", "app:sts2"),
    ("lance Minecraft", "app:minecraft"),
    ("ouvre Roblox", "app:roblox"),
    ("ouvre Roblox Studio", "app:roblox-studio"),
    ("lance Overwatch", "app:overwatch"),
    ("ouvre VS Code", "app:vscode"),
    ("ouvre Visual Studio Code", "app:vscode"),
    ("lance FL Studio", "app:fl"),
    ("ouvre OBS", "app:obs"),
    // Polite or indirect.
    ("tu peux ouvrir Discord", "app:discord"),
    ("tu peux me lancer Steam", "app:steam"),
    ("est-ce que tu peux ouvrir Spotify", "app:spotify"),
    ("peux-tu lancer Hades", "app:hades"),
    ("s'il te plaît ouvre Discord", "app:discord"),
    ("ouvre Discord s'il te plaît", "app:discord"),
    ("je veux jouer à Apex", "app:apex"),
    ("j'ai envie de jouer à Valorant", "app:valorant"),
    ("on joue à Forza", "app:forza"),
    ("on va jouer à Hades", "app:hades"),
    ("ouvre-moi Spotify", "app:spotify"),
    ("lance-moi Blender", "app:blender"),
    ("je voudrais ouvrir Audacity", "app:audacity"),
    ("allez lance Steam", "app:steam"),
    ("vas-y ouvre Discord", "app:discord"),
    // Closing.
    ("ferme Discord", "close:discord"),
    ("quitte Steam", "close:steam"),
    ("ferme-moi Spotify", "close:spotify"),
    ("tu peux fermer Discord", "close:discord"),
    ("arrête Spotify", "close:spotify"),
    ("coupe Discord", "close:discord"),
    // Music.
    ("mets de la musique", "music:play"),
    ("mets un peu de musique", "music:play"),
    ("j'ai envie d'écouter de la musique", "music:play"),
    ("remets la musique", "music:play"),
    ("reprends", "music:play"),
    ("pause", "music:pause"),
    ("mets en pause", "music:pause"),
    ("coupe la musique", "music:pause"),
    ("arrête la musique", "music:pause"),
    ("stop la musique", "music:pause"),
    ("chanson suivante", "music:next"),
    ("passe à la suivante", "music:next"),
    ("change de musique", "music:next"),
    ("musique suivante", "music:next"),
    ("la chanson d'avant", "music:previous"),
    ("remets la précédente", "music:previous"),
    ("monte le son", "music:louder"),
    ("plus fort", "music:louder"),
    ("monte le volume", "music:louder"),
    ("j'entends rien", "music:louder"),
    ("baisse le son", "music:quieter"),
    ("moins fort", "music:quieter"),
    ("c'est trop fort", "music:quieter"),
    ("baisse un peu", "music:quieter"),
    ("coupe le son", "music:mute"),
    ("silence", "music:mute"),
    // Kayro.
    ("montre Kayro", "show"),
    ("ouvre Kayro", "show"),
    ("affiche Kayro", "show"),
    ("cache Kayro", "hide"),
    ("ferme Kayro", "hide"),
    ("cherche Blender", "search"),
    ("trouve-moi Audacity", "search"),
    ("active le mode musique", "musicmode:on"),
    ("arrête d'écouter", "stop"),
    // As the command model wrote the user's own voice (calibration, 2026-11-04).
    ("Do you not firm loss l'escaling", "close:lossless"),
    ("Dis Yuna, m'épose", "music:pause"),
    ("De pose", "music:pause"),
    ("Duna mont le son", "music:louder"),
    ("Do Winabass Le Son", "music:quieter"),
    ("Duna Cash Kayro", "hide"),
    ("Yuna Cash Cairo", "hide"),
];

/// `cargo test -p hub phrasings -- --nocapture`: each miss, then the rate.
#[test]
fn natural_phrasings_are_understood() {
    let apps = apps();
    let scenes = [n("eveil", "éveille")];
    let mut wrong = Vec::new();
    for (said, want) in CASES {
        let got = key(&parse_with(said, &apps, &scenes, &[], &|_| None).intent);
        if got != *want {
            println!("XX « {said} » -> {got} (want {want})");
            wrong.push(*said);
        }
    }
    let right = CASES.len() - wrong.len();
    println!("{right} / {} understood", CASES.len());
    assert!(right * 100 >= CASES.len() * 95, "{wrong:?}");
}
