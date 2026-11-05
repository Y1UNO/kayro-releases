//! The brain's lines read back as Kayro's intents (prompt.rs says what it may write): a line
//! that names nothing of the user's is dropped, the same thing twice in a row is done once.

use super::{link_id, Action, Answer, FollowUp, World, SETTINGS_PAGES};
use crate::platform::audio::AppVolume;
use crate::voice::command::{Intent, Music, Target, WindowAction};

/// A clean text from a free line (a web search, dictation): no control characters, bounded.
fn plain(text: &str, most: usize) -> String {
    text.chars()
        .filter(|c| !c.is_control())
        .take(most)
        .collect::<String>()
        .trim()
        .to_string()
}

/// A song's search without the words around its name (« du Orelsan », « la chanson Toxic »).
fn song(text: &str) -> String {
    const AROUND: [&str; 12] = [
        "la chanson ",
        "le morceau ",
        "le titre ",
        "le son ",
        "la musique ",
        "l'album ",
        "un peu de ",
        "de la ",
        "des ",
        "du ",
        "de ",
        "d'",
    ];
    // A space after: « la chanson » alone is no name either.
    let spaced = format!("{} ", text.trim());
    let mut s = spaced.as_str();
    while let Some(rest) = AROUND.iter().find_map(|w| {
        s.get(..w.len())
            .filter(|head| head.eq_ignore_ascii_case(w))
            .map(|_| &s[w.len()..])
    }) {
        s = rest.trim_start();
    }
    s.trim().to_string()
}

fn window(rest: &str, w: &World) -> Option<Intent> {
    let (who, what) = rest.split_once(' ')?;
    let app = if who == "devant" {
        None
    } else {
        Some(w.apps.iter().find(|a| a.id == who)?.id.clone())
    };
    if what.trim() == "fermer" {
        return Some(match app {
            Some(id) => Intent::Close(id),
            None => Intent::Window {
                app: None,
                what: WindowAction::Close,
            },
        });
    }
    let what = match what.trim() {
        "plein" => WindowAction::Maximize,
        "cacher" | "reduire" => WindowAction::Minimize,
        "restaurer" => WindowAction::Restore,
        "devant" => WindowAction::Front,
        "gauche" => WindowAction::Left,
        "droite" => WindowAction::Right,
        "fermer" => WindowAction::Close,
        other => WindowAction::Screen(
            other
                .strip_prefix("ecran ")?
                .trim()
                .parse()
                .ok()
                .filter(|n| *n >= 1)?,
        ),
    };
    Some(Intent::Window { app, what })
}

fn one(verb: &str, rest: &str, w: &World) -> (Option<Intent>, Option<u32>) {
    let app = |id: &str| w.apps.iter().any(|a| a.id == id).then(|| id.to_string());
    let mut screen = None;
    let intent = match verb {
        "ouvrir" => {
            let (id, after) = rest.split_once(" ecran ").unwrap_or((rest, ""));
            screen = after.trim().parse().ok().filter(|n| *n >= 1);
            if id.trim() == super::FILES_ID {
                Some(Intent::Files)
            } else {
                app(id.trim()).map(|id| Intent::Launch(Target::App(id)))
            }
        }
        "fermer" => app(rest).map(Intent::Close),
        "scene" => w
            .scenes
            .iter()
            .find(|s| s.id == rest)
            .map(|s| Intent::Launch(Target::Scene(s.id.clone()))),
        "ecouter" => (0..w.links.len())
            .find(|i| link_id(w.links, *i) == rest)
            .map(|i| Intent::Link(w.links[i].id.clone())),
        "musique" => match rest {
            "lecture" => Some(Intent::Music(Music::Play)),
            "pause" => Some(Intent::Music(Music::Pause)),
            "suivante" => Some(Intent::Music(Music::Next)),
            "precedente" => Some(Intent::Music(Music::Previous)),
            "aleatoire" => Some(Intent::Music(Music::ShuffleOn)),
            "ordre" => Some(Intent::Music(Music::ShuffleOff)),
            "repeter" => Some(Intent::Music(Music::RepeatOn)),
            "sans-repeter" => Some(Intent::Music(Music::RepeatOff)),
            "titre" => Some(Intent::WhichSong),
            _ => None,
        },
        "volume" => match rest {
            "plus" => Some(Intent::Music(Music::Louder)),
            "moins" => Some(Intent::Music(Music::Quieter)),
            "muet" => Some(Intent::Music(Music::Mute)),
            _ => None,
        },
        "son" => rest
            .parse::<u8>()
            .ok()
            .map(|n| Intent::VolumeTo(n.min(100))),
        "son-app" => {
            let Some((id, what)) = rest.split_once(' ') else {
                return (None, None);
            };
            let what = match what.trim() {
                "plus" => AppVolume::Louder,
                "moins" => AppVolume::Quieter,
                "muet" => AppVolume::Mute,
                "remettre" => AppVolume::Unmute,
                _ => return (None, None),
            };
            app(id).map(|app| Intent::AppVolume { app, what })
        }
        "musique-app" => {
            let Some((id, what)) = rest.split_once(' ') else {
                return (None, None);
            };
            let what = match what.trim() {
                "lecture" => Music::Play,
                "pause" => Music::Pause,
                "suivante" => Music::Next,
                "precedente" => Music::Previous,
                _ => return (None, None),
            };
            app(id).map(|app| Intent::AppMusic { app, what })
        }
        "micro" => match rest {
            "couper" => Some(Intent::Mic(true)),
            "remettre" => Some(Intent::Mic(false)),
            _ => None,
        },
        "fenetre" => window(rest, w),
        "dernier-jeu" => Some(Intent::LastGame),
        "reglages" => SETTINGS_PAGES
            .contains(&rest)
            .then(|| Intent::Settings(rest.to_string())),
        "theme" => w
            .themes
            .iter()
            .find(|t| t.id == rest)
            .map(|t| Intent::Theme(t.id.clone())),
        "kysland" => Some(Intent::Kysland(rest == "oui")),
        "mode-musique" => Some(Intent::MusicMode(rest == "oui")),
        "mains" => Some(Intent::Hands(rest == "oui")),
        "kayro" => match rest {
            "montrer" => Some(Intent::ShowKayro),
            "cacher" => Some(Intent::HideKayro),
            _ => None,
        },
        "chercher" if !rest.is_empty() => Some(Intent::Search(plain(rest, 40))),
        "web" if !rest.is_empty() => Some(Intent::WebSearch(plain(rest, 60))),
        "spotify" => Some(song(&plain(rest, 60)))
            .filter(|q| !q.is_empty())
            .map(Intent::SpotifySearch),
        "ecrire" if !rest.is_empty() => Some(Intent::Dictate(plain(rest, 300))),
        "verrouiller" => Some(Intent::Lock),
        "bureau" => Some(Intent::Desktop),
        "explorateur" => Some(Intent::Files),
        "minuteur" => rest
            .parse::<u32>()
            .ok()
            .filter(|n| (1..=999).contains(n))
            .map(Intent::Timer),
        "heure" => Some(Intent::Time),
        "capture" => Some(Intent::Screenshot),
        "stop-ecoute" => Some(Intent::StopListening),
        "inconnu" => Some(Intent::Unknown),
        _ => None,
    };
    (intent, screen)
}

/// `answer`, for a sentence that follows something done: « ferme-le », « mets-le à droite »
/// right after « ouvrir discord » mean Discord, not whatever is in front.
pub fn answer_after(text: &str, w: &World, follow: &FollowUp) -> Answer {
    let mut a = answer(text, w);
    let FollowUp::After(done) = follow else {
        return a;
    };
    let Some(just_opened) = done
        .strip_prefix("ouvrir ")
        .map(|rest| rest.split(' ').next().unwrap_or("").to_string())
        .filter(|id| !done.contains(',') && w.apps.iter().any(|x| x.id == *id))
    else {
        return a;
    };
    for action in &mut a.actions {
        if let Intent::Window { app: None, what } = &action.intent {
            action.intent = match what {
                WindowAction::Close => Intent::Close(just_opened.clone()),
                other => Intent::Window {
                    app: Some(just_opened.clone()),
                    what: *other,
                },
            };
        }
    }
    a
}

/// The brain's lines as Kayro's intents; a line that names nothing of the user's is dropped.
pub fn answer(text: &str, w: &World) -> Answer {
    let mut lines = text.lines().map(str::trim).filter(|l| !l.is_empty());
    let called = lines.next() == Some("appel oui");
    if !called {
        return Answer::default();
    }
    let mut actions: Vec<Action> = Vec::new();
    for line in lines {
        let (verb, rest) = line.split_once(' ').unwrap_or((line, ""));
        let (intent, screen) = one(verb, rest.trim(), w);
        let Some(intent) = intent else { continue };
        // The same thing twice in a row is done once (« ouvrir discord » then « ouvrir discord
        // ecran 1 »: the screen named is kept).
        let action = Action { intent, screen };
        match actions.last_mut() {
            Some(last) if last.intent == action.intent => {
                if action.screen.is_some() {
                    last.screen = action.screen;
                }
            }
            _ => actions.push(action),
        }
    }
    tidy(&mut actions);
    Answer { called, actions }
}

/// « Mets la lecture aléatoire » is the mode, not a play too; « mets le son à vingt » is the
/// level, not a step too; « joue ma playlist X sur Spotify » is the playlist, not a play too.
fn tidy(actions: &mut Vec<Action>) {
    let mode = actions.iter().any(|a| {
        matches!(
            a.intent,
            Intent::Music(
                Music::ShuffleOn | Music::ShuffleOff | Music::RepeatOn | Music::RepeatOff
            )
        )
    });
    let level = actions
        .iter()
        .any(|a| matches!(a.intent, Intent::VolumeTo(_)));
    let playlist = actions
        .iter()
        .any(|a| matches!(a.intent, Intent::Link(_) | Intent::SpotifySearch(_)));
    actions.retain(|a| {
        let play = matches!(
            a.intent,
            Intent::Music(Music::Play)
                | Intent::AppMusic {
                    what: Music::Play,
                    ..
                }
        );
        // The user's music opens in Spotify itself: « … sur Spotify » is no launch too.
        let spotify =
            matches!(&a.intent, Intent::Launch(Target::App(id)) if id.contains("spotify"));
        !((mode || playlist) && play)
            && !(playlist && spotify)
            && !(level && matches!(a.intent, Intent::Music(Music::Louder | Music::Quieter)))
    });
}
