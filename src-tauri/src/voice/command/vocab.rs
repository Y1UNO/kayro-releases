//! The words of the voice's commands: the verbs and little words, the music's sayings, the
//! words the command model leans toward (hotwords), and how a sentence is normalized.

use super::{Music, Named};
use crate::voice::wake::words;

/// The verbs, with how a quick saying is often heard (« mets » → « mais », « ouvre » → « ou »).
pub(super) const LAUNCH: &[&str] = &[
    "lance", "lancer", "lancez", "ouvre", "ouvrir", "ouvrez", "demarre", "demarrer", "joue",
    "jouer", "mets", "met", "mais", "ou", "start", "allume", "lances", "montre", "affiche",
];
/// « Coupe », « arrête » close an app; with the music (« coupe la musique ») they are the music's.
pub(super) const CLOSE: &[&str] = &[
    "ferme", "fermer", "fermez", "quitte", "quitter", "quittez", "arrete", "arreter", "coupe",
    "couper", "eteins", "eteindre", "stoppe", "firm",
];
/// « Cash » : « cache » as the command model writes it in English.
pub(super) const HIDE: &[&str] = &["cache", "cacher", "masque", "masquer", "cash"];
pub(super) const SEARCH: &[&str] = &["cherche", "chercher", "recherche", "rechercher", "trouve"];
/// Little words between the verb and the name (« lance le jeu Elden Ring »).
pub(super) const FILLER: &[&str] = &[
    "le",
    "la",
    "les",
    "l",
    "un",
    "une",
    "a",
    "au",
    "aux",
    "de",
    "du",
    "des",
    "moi",
    "jeu",
    "app",
    "application",
    "appli",
    "programme",
    "logiciel",
    "stp",
    "svp",
    "please",
];
pub(super) const STOP: &[&str] = &[
    "arrete d ecouter",
    "arrete decouter",
    "arrete ecouter",
    "coupe le micro",
    "coupe micro",
    "stop micro",
    "stop ecoute",
];

/// Lower case, no accents, words of letters and digits (« GAT3 » → « gat 3 »), numbers as
/// digits (« deux », « II » → 2).
pub fn normalize(text: &str) -> String {
    let mut spaced = String::new();
    let mut last: Option<char> = None;
    for c in text.chars().flat_map(char::to_lowercase) {
        let c = match c {
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'à' | 'â' | 'ä' => 'a',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            c if c.is_alphanumeric() => c,
            _ => ' ',
        };
        let switch =
            last.is_some_and(|l| l.is_ascii_digit() != c.is_ascii_digit() && c != ' ' && l != ' ');
        if switch {
            spaced.push(' ');
        }
        spaced.push(c);
        last = Some(c);
    }
    spaced
        .split_whitespace()
        .map(|w| match w {
            "deux" | "ii" => "2",
            "trois" | "iii" => "3",
            "quatre" | "iv" => "4",
            "cinq" => "5",
            "six" => "6",
            "sept" => "7",
            "huit" => "8",
            "neuf" => "9",
            "dix" => "10",
            w => w,
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Words that say « music » (« mets ma playlist chill »): then the user's music comes first.
pub(super) const MUSIC_WORDS: &[&str] = &[
    "playlist", "album", "titre", "chanson", "morceau", "musique", "son",
];

/// A command verb (to launch, close, hide or search).
pub(super) fn is_verb(word: &str) -> bool {
    [LAUNCH, CLOSE, HIDE, SEARCH]
        .iter()
        .any(|list| list.contains(&word))
}

/// A normalized sentence without its « s'il te plaît », « merci »…
pub(super) fn polite(said: &str) -> String {
    let mut s = format!(" {said} ");
    for p in [
        " s il te plait ",
        " s il vous plait ",
        " s te plait ",
        " merci beaucoup ",
        " merci ",
    ] {
        while s.contains(p) {
            s = s.replace(p, " ");
        }
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Where the command starts in a sentence (bytes): at its first command verb, if it has one
/// among its first four words (« Kérot, ouvre Steam » → « ouvre Steam »).
pub fn verb_start(text: &str) -> Option<usize> {
    let verbs: Vec<&str> = LAUNCH
        .iter()
        .chain(CLOSE)
        .chain(HIDE)
        .chain(SEARCH)
        .copied()
        .collect();
    words(text)
        .into_iter()
        .take(4)
        .find(|&(s, e)| verbs.contains(&normalize(&text[s..e]).as_str()))
        .map(|(s, _)| s)
}

/// The wake word part of a sentence said while learning: its words before the first command verb
/// (« DIOUNOV LANCE SPOTIFY » → « DIOUNOV »), three at most, letters only.
pub fn wake_part(text: &str) -> String {
    let verbs: Vec<&str> = LAUNCH
        .iter()
        .chain(CLOSE)
        .chain(HIDE)
        .chain(SEARCH)
        .copied()
        .collect();
    let mut kept = Vec::new();
    for (s, e) in words(text) {
        let word = &text[s..e];
        if verbs.contains(&normalize(word).as_str()) || kept.len() == 3 {
            break;
        }
        let letters: String = word
            .chars()
            .filter(|c| c.is_alphabetic() || *c == '\'')
            .collect();
        if !letters.is_empty() {
            kept.push(letters);
        }
    }
    kept.join(" ")
}

/// Is `phrase` in `said`, as whole words?
pub(super) fn says(said: &str, phrase: &str) -> bool {
    format!(" {said} ").contains(&format!(" {phrase} "))
}

/// The music: what to do to what plays (« mets pause », « musique suivante », « plus fort »…).
pub(super) fn music(said: &str) -> Option<Music> {
    let any = |list: &[&str]| list.iter().any(|p| says(said, p));
    let rules: [(&[&str], Music); 7] = [
        (&["coupe le son", "mute", "silence"], Music::Mute),
        (
            &[
                "pause",
                "stop la musique",
                "arrete la musique",
                "coupe la musique",
                "m epouse",
                "epouse",
                "m epose",
                "epose",
                "pose",
            ],
            Music::Pause,
        ),
        (
            &[
                "suivante",
                "suivant",
                "d apres",
                "next",
                "passe la musique",
                "passe la chanson",
                "passe le morceau",
                "zappe",
                "change de musique",
                "change de chanson",
                "change de morceau",
                "une autre chanson",
                "une autre musique",
            ],
            Music::Next,
        ),
        (
            &["precedente", "precedent", "d avant", "reviens en arriere"],
            Music::Previous,
        ),
        (
            &[
                "monte le son",
                "plus fort",
                "augmente le son",
                "augmente le volume",
                "monte le volume",
                "monte la musique",
                "j entends rien",
                "on entend rien",
                "j entends pas",
                "on entend pas",
                "pas assez fort",
                "monte un peu",
                "mont le son",
                "mont le volume",
            ],
            Music::Louder,
        ),
        (
            &[
                "baisse le son",
                "moins fort",
                "baisse le volume",
                "diminue le son",
                "diminue le volume",
                "baisse la musique",
                "trop fort",
                "baisse un peu",
                "bass le son",
                "basse le son",
            ],
            Music::Quieter,
        ),
        (
            &[
                "mets la musique",
                "met la musique",
                "mais la musique",
                "mets de la musique",
                "lance la musique",
                "remets la musique",
                "reprends la musique",
                "reprend la musique",
                "joue la musique",
                "reprends",
                "reprend",
                "play",
                "lecture",
                "relance la musique",
                "de la musique",
                "un peu de musique",
                "ecouter la musique",
            ],
            Music::Play,
        ),
    ];
    rules
        .iter()
        .find(|(words, _)| any(words))
        .map(|(_, m)| *m)
        .or_else(|| glued(said))
}

/// A volume verb glued to the wake word as it was written (« Do Winabass le son » for « Dis
/// Yuna, baisse le son »).
fn glued(said: &str) -> Option<Music> {
    let ws: Vec<&str> = said.split_whitespace().collect();
    ws.windows(3).find_map(|w| {
        let what = matches!(w[1], "le" | "la") && matches!(w[2], "son" | "musique" | "volume");
        let ends = |verbs: &[&str]| verbs.iter().any(|v| w[0].ends_with(v));
        match () {
            _ if !what => None,
            _ if ends(&["baisse", "basse", "bass"]) => Some(Music::Quieter),
            _ if ends(&["monte", "mont"]) => Some(Music::Louder),
            _ => None,
        }
    })
}

/// The words the command model leans toward (hotwords, one per line): the wake word and its name
/// (« :3 », more), the apps and scenes of the configuration, and the commands' own words.
pub fn hotwords(wake_word: &str, apps: &[Named], scenes: &[Named], links: &[Named]) -> String {
    let clean = |s: &str| -> String {
        s.chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '\'' {
                    c
                } else {
                    ' '
                }
            })
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    };
    let wake = clean(wake_word);
    let name = wake
        .split(' ')
        .max_by_key(|w| w.chars().count())
        .unwrap_or("")
        .to_string();
    let mut lines: Vec<String> = [wake.as_str(), name.as_str()]
        .iter()
        .filter(|w| !w.is_empty())
        .map(|w| format!("{w} :3"))
        .collect();
    // The user's names, gently (0.5): pushed hard, 127 of them turned « ouvre » into « Overwatch »
    // and a breath into « Claude Claude Claude… » (the user's calibration, 2026-11-04: 11 → 15
    // commands right of 20).
    lines.extend(
        apps.iter()
            .chain(scenes)
            .chain(links)
            .map(|n| clean(&n.name))
            .filter(|n| !n.is_empty())
            .map(|n| format!("{n} :0.5")),
    );
    lines.extend(
        [
            "lance",
            "ouvre",
            "ferme",
            "mets pause",
            "mets la musique",
            "musique suivante",
            "musique précédente",
            "monte le son",
            "baisse le son",
            "coupe le son",
            "mode musique",
            "Kayro",
        ]
        .map(String::from),
    );
    lines.dedup();
    lines.join(
        "
",
    )
}
