//! What the brain is told and what it may answer. The answer is held by a grammar (llama.cpp
//! GBNF) to a few short lines: « appel oui », then one line per thing asked (« ouvrir discord
//! ecran 1 », « fenetre devant plein », « son 30 », « inconnu »…), the apps, scenes and themes
//! only among the user's own (by id). Read back (read.rs), each line becomes one of Kayro's
//! intents, checked again against the lists: nothing else can come out of it (CLAUDE.md). With
//! each sentence the brain is also told what is in front (`Context`, think.rs), so that « ça »,
//! « cette fenêtre », « le » have a target. Measured on the user's calibration (2026-11-04):
//! 40/40 sentences, 0.19 s each.

mod read;

pub use read::{answer, answer_after};

use crate::voice::command::{Intent, Named};

/// Windows' File Explorer, told among the apps (the brain picks from that list: told apart, it
/// took « 7-Zip File Manager » for it). « ouvrir explorateur » opens it (Win+E).
pub const FILES_ID: &str = "explorateur";

/// The user's apps, then File Explorer.
fn with_files(apps: &[Named]) -> Vec<Named> {
    let mut all = apps.to_vec();
    if !all.iter().any(|a| a.id == FILES_ID) {
        all.push(Named {
            id: FILES_ID.into(),
            name: "Explorateur de fichiers (Windows : mes fichiers, mes dossiers)".into(),
        });
    }
    all
}

/// The user's world, as the brain is told it.
pub struct World<'a> {
    pub wake_word: &'a str,
    pub apps: &'a [Named],
    pub scenes: &'a [Named],
    /// The user's music by name (« Votre musique »): its id is its Spotify address.
    pub links: &'a [Named],
    /// The themes installed (« mets le thème Encre »).
    pub themes: &'a [Named],
    /// How many screens the PC has (« ecran N » only when there are several).
    pub screens: usize,
}

/// One thing asked, and the screen it goes on (« mets Discord sur mon premier écran »).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Action {
    pub intent: Intent,
    pub screen: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Answer {
    /// The sentence was said to the assistant (its name, at the start).
    pub called: bool,
    pub actions: Vec<Action>,
}

/// What a sentence follows: the brain is told, in a few words before the sound.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum FollowUp {
    #[default]
    None,
    /// A call with nothing asked (« Arya… »), or the push-to-talk shortcut held: the sentence is
    /// said to the assistant.
    Called,
    /// What was just done, as the brain's lines (« musique suivante »): the sentence may go on
    /// with it without the name (« en fait, reviens à la précédente »); the brain judges.
    After(String),
}

/// The window in front, as the brain is told it.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Front {
    /// One of the user's apps (its id), if it is one.
    pub app: Option<String>,
    /// Else its program and title (« chrome.exe », « YouTube »).
    pub exe: String,
    pub title: String,
    pub screen: Option<u32>,
}

/// What is in front of the user when the sentence is said (nothing is kept of it).
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Context {
    pub front: Option<Front>,
    /// The user's apps running now (ids).
    pub open: Vec<String>,
}

/// The pages of Réglages a sentence may open (`reglages <page>`).
pub const SETTINGS_PAGES: [&str; 9] = [
    "general",
    "demarrage",
    "raccourcis",
    "kysland",
    "visuel",
    "sons",
    "themes",
    "voix",
    "mains",
];

/// The few words said before the sound: what is in front, and what the sentence follows.
pub fn hint(follow: &FollowUp, wake_word: &str, context: &Context) -> Option<String> {
    let name = name_of(wake_word);
    let mut parts = Vec::new();
    let front = match &context.front {
        Some(Front {
            app: Some(id),
            screen,
            ..
        }) => format!(
            "Fenêtre devant : {id}{}.",
            screen.map_or(String::new(), |n| format!(", écran {n}"))
        ),
        Some(Front { exe, title, .. }) => format!("Fenêtre devant : {exe} « {title} »."),
        None => "Aucune fenêtre devant.".to_string(),
    };
    let open = if context.open.is_empty() {
        "aucune".to_string()
    } else {
        context.open.join(", ")
    };
    parts.push(format!("({front} Apps ouvertes : {open}.)"));
    match follow {
        FollowUp::None => {}
        FollowUp::Called => parts.push(format!(
            "(L'utilisateur vient d'appeler {name} : cette phrase lui est adressée.)"
        )),
        FollowUp::After(done) => parts.push(format!(
            "({name} vient de faire : {done}. Cette phrase peut lui être adressée sans son nom si elle continue cette demande (« en fait… », « encore », « remets… », « non, plutôt… », « et… ») : appel oui et ce qu'elle demande. Si elle parle d'autre chose ou à quelqu'un d'autre : appel non.)"
        )),
    }
    Some(parts.join(" "))
}

/// What the brain did, as its own lines (`FollowUp::After`), from its answer.
pub fn done_lines(text: &str) -> String {
    text.lines()
        .skip(1)
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(", ")
}

/// The wake word's most telling word (« Arya » in « Dis Arya »): the assistant's name.
pub fn name_of(wake_word: &str) -> String {
    wake_word
        .split(|c: char| c.is_whitespace() || c == '\'' || c == '’' || c == '-' || c == ',')
        .max_by_key(|w| w.chars().count())
        .unwrap_or("")
        .to_string()
}

/// A GBNF string literal.
fn literal(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' | '\r' | '\t' => out.push(' '),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn one_of(ids: impl Iterator<Item = String>) -> String {
    let all: Vec<String> = ids.map(|i| literal(&i)).collect();
    if all.is_empty() {
        // A rule that can never be written.
        "\"\\x00\"".to_string()
    } else {
        all.join(" | ")
    }
}

/// A link's id for the brain: its name in plain words (« kiff-du-moment »), so that the name
/// heard leads to it (Spotify addresses are long and opaque; with « l1 », « l2 »… the brain put
/// the music on instead of the playlist: 4/21, 2026-11-05). « l3 » when the name gives nothing,
/// is too long or is taken.
pub(super) fn link_id(links: &[Named], i: usize) -> String {
    let slug = |n: &Named| {
        crate::voice::command::normalize(&n.name)
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("-")
    };
    let mine = slug(&links[i]);
    let taken = links[..i].iter().any(|n| slug(n) == mine);
    if mine.is_empty() || taken || mine.len() > 40 {
        format!("l{}", i + 1)
    } else {
        mine
    }
}

pub fn grammar(w: &World) -> String {
    let screen = if w.screens >= 2 {
        format!(" (\" ecran \" [1-{}])?", w.screens.min(9))
    } else {
        String::new()
    };
    let fscreen = if w.screens >= 2 {
        format!("\"ecran \" [1-{}] | ", w.screens.min(9))
    } else {
        String::new()
    };
    format!(
        r#"root ::= "appel " ("oui" | "non") ("\n" action){{0,4}}
action ::= ouvrir | fermer | scene | ecouter | musique | volume | mode | mains | kayro | chercher | stop | fenetre | son | sonapp | musiqueapp | micro | jeu | reglages | theme | kysland | verrou | bureau | explorateur | minuteur | heure | capture | web | spotify | ecrire | inconnu
ouvrir ::= "ouvrir " app{screen}
fermer ::= "fermer " app
scene ::= "scene " sceneid
ecouter ::= "ecouter " link
musique ::= "musique " ("lecture" | "pause" | "suivante" | "precedente" | "aleatoire" | "ordre" | "repeter" | "sans-repeter" | "titre")
volume ::= "volume " ("plus" | "moins" | "muet")
mode ::= "mode-musique " ("oui" | "non")
mains ::= "mains " ("oui" | "non")
kayro ::= "kayro " ("montrer" | "cacher")
chercher ::= "chercher " [^\n]{{1,40}}
stop ::= "stop-ecoute"
fenetre ::= "fenetre " (("devant" | app) " " ({fscreen}"plein" | "cacher" | "restaurer" | "devant" | "gauche" | "droite") | "devant fermer")
son ::= "son " [0-9] [0-9]? [0-9]?
sonapp ::= "son-app " app " " ("plus" | "moins" | "muet" | "remettre")
musiqueapp ::= "musique-app " app " " ("lecture" | "pause" | "suivante" | "precedente")
micro ::= "micro " ("couper" | "remettre")
jeu ::= "dernier-jeu"
reglages ::= "reglages " ({pages})
theme ::= "theme " themeid
kysland ::= "kysland " ("oui" | "non")
verrou ::= "verrouiller"
bureau ::= "bureau"
explorateur ::= "explorateur"
minuteur ::= "minuteur " [1-9] [0-9]? [0-9]?
heure ::= "heure"
capture ::= "capture"
web ::= "web " [^\n]{{1,60}}
spotify ::= "spotify " [^\n]{{1,60}}
ecrire ::= "ecrire " [^\n]{{1,300}}
inconnu ::= "inconnu"
app ::= {apps}
sceneid ::= {scenes}
link ::= {links}
themeid ::= {themes}
"#,
        pages = one_of(SETTINGS_PAGES.iter().map(|p| p.to_string())),
        apps = one_of(with_files(w.apps).iter().map(|a| a.id.clone())),
        scenes = one_of(w.scenes.iter().map(|s| s.id.clone())),
        links = one_of((0..w.links.len()).map(|i| link_id(w.links, i))),
        themes = one_of(w.themes.iter().map(|t| t.id.clone())),
    )
}

/// An app asked for by what it is (the list says it, brain/apps.rs).
const KINDS: &str =
    "Une app demandée par ce qu'elle est (« mon navigateur », « un jeu de course », \
« mon logiciel de montage », « de quoi coder ») : l'app de la liste qui est de cette sorte (entre \
parenthèses, ou un jeu de ce genre), la première s'il y en a plusieurs.\n";

/// The harnesses measure the brain as it was told the apps before 2026-11-05
/// (`KAYRO_VOICE_PLAIN_APPS=1`).
fn plain_apps() -> bool {
    cfg!(test) && std::env::var_os("KAYRO_VOICE_PLAIN_APPS").is_some()
}

pub fn system(w: &World) -> String {
    let name = name_of(w.wake_word);
    let wake = w.wake_word.trim();
    let list = |items: &[Named], id: &dyn Fn(usize, &Named) -> String| -> String {
        if items.is_empty() {
            return "(aucune)".into();
        }
        items
            .iter()
            .enumerate()
            .map(|(i, n)| format!("{} = {}", id(i, n), n.name))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let screens = if w.screens >= 2 {
        format!(
            "ouvrir <app> ecran N : si un écran est nommé (premier = 1, deuxième = 2 ; l'ordinateur en a {}).\n",
            w.screens
        )
    } else {
        String::new()
    };
    format!(
        "Tu es l'oreille de Kayro, un lanceur d'applications sur PC. L'utilisateur parle français à \
son assistant « {name} » (il commence par « {wake} » ou « {name} »). Avant l'audio, une ligne dit \
quelle fenêtre est devant et quelles apps sont ouvertes.
Écoute l'audio. Première ligne : « appel oui » si la phrase s'adresse à {name} (son nom au début), \
sinon « appel non » et rien d'autre. Son nom seulement mentionné (« avec {name} », « à {name} »), \
sans rien lui demander : appel non.
Puis une ligne par chose demandée, dans l'ordre :
ouvrir <app> : ouvrir, lancer, démarrer, activer, jouer à, aller sur une app.
{screens}fermer <app> : fermer, quitter, couper, arrêter une app (« ferme-le » après l'avoir ouverte aussi) ; \
fermer n'est jamais cacher.
fenetre <app ou devant> ecran N | plein | cacher | restaurer | devant | gauche | droite : une app \
de « Apps ouvertes » (ou « devant » : « ça », « cette fenêtre », « le ») mise sur un écran, en plein \
écran (agrandie), cachée (cacher, masquer, réduire une app), restaurée, passée devant, à gauche, à \
droite. Une app absente d'« Apps ouvertes » s'ouvre (ouvrir, avec ecran N s'il est dit). fenetre \
devant fermer : fermer ce qui est devant.
scene <id> : lancer une scène.
ecouter <id> : mettre une musique de l'utilisateur (sa playlist, son album…) dès que son nom est dit, avec ou \
sans « playlist » (jamais « musique lecture » à sa place). Sans nom (« cette playlist », « la musique ») : musique.
spotify <titre, artiste ou album> : mettre, jouer, lancer une musique nommée (une chanson, un artiste, un \
album) qui n'est ni une app de la liste ni dans « Musiques de l'utilisateur » ; écris seulement son nom, tel \
qu'il est dit (« mets la chanson Toxic » → spotify toxic). Jouer à un jeu : ouvrir.
musique lecture | pause | suivante | precedente | aleatoire | ordre | repeter | sans-repeter | titre : \
la musique (mettre de la musique = lecture ; couper, arrêter la musique = pause ; titre = quel est ce morceau).
musique-app <app> lecture | pause | suivante | precedente : seulement quand une app est nommée, la \
vidéo ou la musique de cette app (« mets play sur Comet », « relance la vidéo dans mon navigateur »).
volume plus | moins | muet : monter, baisser, couper le son du PC. son N : seulement quand un nombre \
est dit (« à trente », « cinquante pour cent »).
son-app <app> plus | moins | muet | remettre : monter, baisser, couper le son d'une seule app \
(« baisse Discord », « monte Spotify » : toujours le son, jamais la fenêtre).
micro couper | remettre : le micro de l'utilisateur.
mode-musique oui | non : seulement si « mode musique » est dit.
mains oui | non : la souris par les mains, avec la caméra (« active les mains », « coupe les mains »).
kayro montrer : montrer, ouvrir, afficher Kayro lui-même ; kayro cacher : cacher, planquer, masquer \
Kayro lui-même (« cache-toi », « cache Kayro »), jamais une autre app.
chercher <mots> : chercher dans Kayro. web <mots> : chercher sur internet.
reglages general | demarrage | raccourcis | kysland | visuel | sons | themes | voix | mains : ouvrir cette page des réglages de Kayro.
theme <id> : mettre un thème de Kayro. kysland oui | non : Kysland (l'île) toujours à l'écran, ou non.
dernier-jeu : relancer le dernier jeu.
verrouiller : verrouiller la session. bureau : afficher le bureau (tout cacher, tout réduire). explorateur : ouvrir \
l'explorateur de fichiers de Windows (« mes fichiers », « mes dossiers »). capture : une capture d'écran.
minuteur N : seulement quand un minuteur, un chrono, une alarme ou un rappel de N minutes est demandé. \
heure : quelle heure il est.
ecrire <texte> : écrire, taper, dicter ce texte.
stop-ecoute : arrêter d'écouter.
inconnu : rien de cette liste ne correspond (un fichier, une vidéo, éteindre, un programme absent de \
la liste…) : écris « inconnu », n'invente ni app ni action.
Les noms d'apps sont souvent anglais et mal prononcés : prends l'app de la liste qui sonne le plus \
pareil, seulement si c'en est bien une (un site, une vidéo, un programme absent : inconnu).
{kinds}Exemples :
« {name}, lance un peu de musique » → appel oui / musique lecture
« {wake}, passe à la suivante et monte le son » → appel oui / musique suivante / volume plus
« {wake}, tu peux m'ouvrir Steam et Discord ? » → appel oui / ouvrir steam / ouvrir discord
« {name}, planque Kayro » → appel oui / kayro cacher
« {name}, ouvre l'explorateur de fichiers » → appel oui / ouvrir explorateur
« {name}, cache Spotify et ferme Discord » (ouverts) → appel oui / fenetre spotify cacher / fermer discord
« {name}, mets pause sur Edge » → appel oui / musique-app edge pause
« {name}, mets pause » → appel oui / musique pause
« {name}, mets Discord en plein écran » (Discord ouvert) → appel oui / fenetre discord plein
« {name}, ferme ça » → appel oui / fenetre devant fermer
« {name}, ouvre les réglages de la voix » → appel oui / reglages voix
{link_example}« {name}, joue Thriller de Michael Jackson » → appel oui / spotify thriller michael jackson
« {name}, mets du Stromae » → appel oui / spotify stromae
« {name}, ouvre YouTube » → appel oui / inconnu
« J'ai fermé Discord tout à l'heure » → appel non
{apps_title}
{apps}
Scènes :
{scenes}
Musiques de l'utilisateur :
{links}
Thèmes (id = nom) :
{themes}",
        apps = list(&with_files(w.apps), &|_, n| n.id.clone()),
        kinds = if plain_apps() { "" } else { KINDS },
        apps_title = if plain_apps() { "Apps (id = nom) :" } else { "Apps (id = nom (ce qu'elle est)) :" },
        scenes = list(w.scenes, &|_, n| n.id.clone()),
        links = list(w.links, &|i, _| link_id(w.links, i)),
        link_example = match w.links.first() {
            Some(l) => format!(
                "« {0}, mets ma playlist {1} » → appel oui / ecouter {2}\n« {0}, répète cette playlist » → appel oui / musique repeter\n",
                name_of(w.wake_word),
                l.name,
                link_id(w.links, 0)
            ),
            None => String::new(),
        },
        themes = list(w.themes, &|_, n| n.id.clone()),
    )
}

#[cfg(test)]
#[path = "prompt_tests.rs"]
mod tests;
