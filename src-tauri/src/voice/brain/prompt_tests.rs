use super::*;
use crate::voice::command::{Music, Target};

fn n(id: &str, name: &str) -> Named {
    Named {
        id: id.into(),
        name: name.into(),
    }
}

fn world<'a>(
    apps: &'a [Named],
    scenes: &'a [Named],
    links: &'a [Named],
    screens: usize,
) -> World<'a> {
    World {
        wake_word: "Dis Arya",
        apps,
        scenes,
        links,
        themes: &[],
        screens,
    }
}

#[test]
fn the_assistant_is_named_by_its_wake_words_longest_word() {
    assert_eq!(name_of("Dis Arya"), "Arya");
    assert_eq!(name_of("Hé Kayro"), "Kayro");
    assert_eq!(name_of("Yuna"), "Yuna");
}

#[test]
fn an_answer_becomes_kayros_intents_and_nothing_else() {
    let apps = [n("spotify", "Spotify"), n("discord", "Discord")];
    let scenes = [n("eveille", "éveille")];
    let links = [n("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M", "Chill")];
    let w = world(&apps, &scenes, &links, 2);
    let a = answer(
        "appel oui\nouvrir spotify\nouvrir discord ecran 2\nfermer discord\nscene eveille\n\
         ecouter l1\nmusique pause\nvolume moins\nmode-musique non\nkayro cacher\n\
         chercher blender\nstop-ecoute",
        &w,
    );
    assert!(a.called);
    let got: Vec<(Intent, Option<u32>)> = a
        .actions
        .into_iter()
        .map(|x| (x.intent, x.screen))
        .collect();
    assert_eq!(
        got,
        [
            (Intent::Launch(Target::App("spotify".into())), None),
            (Intent::Launch(Target::App("discord".into())), Some(2)),
            (Intent::Close("discord".into()), None),
            (Intent::Launch(Target::Scene("eveille".into())), None),
            (
                Intent::Link("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M".into()),
                None
            ),
            (Intent::Music(Music::Pause), None),
            (Intent::Music(Music::Quieter), None),
            (Intent::MusicMode(false), None),
            (Intent::HideKayro, None),
            (Intent::Search("blender".into()), None),
            (Intent::StopListening, None),
        ]
    );
}

#[test]
fn an_unknown_app_or_a_call_not_made_does_nothing() {
    let apps = [n("spotify", "Spotify")];
    let w = world(&apps, &[], &[], 1);
    assert_eq!(answer("appel non\nouvrir spotify", &w), Answer::default());
    let a = answer(
        "appel oui\nouvrir notepad\nfermer cmd\necouter l1\nscene x",
        &w,
    );
    assert!(a.called && a.actions.is_empty());
    assert_eq!(answer("", &w), Answer::default());
}

#[test]
fn the_same_thing_twice_in_a_row_is_done_once() {
    let apps = [n("steam", "Steam"), n("discord", "Discord")];
    let w = world(&apps, &[], &[], 2);
    let a = answer("appel oui\nouvrir steam\nouvrir steam\nmusique pause", &w);
    assert_eq!(a.actions.len(), 2);
    // A hesitation on the screen (« Discord sur mon premier écran »): the screen named wins.
    let a = answer(
        "appel oui\nouvrir steam\nouvrir discord\nouvrir discord ecran 1\nouvrir discord",
        &w,
    );
    let got: Vec<(Intent, Option<u32>)> = a
        .actions
        .into_iter()
        .map(|x| (x.intent, x.screen))
        .collect();
    assert_eq!(
        got,
        [
            (Intent::Launch(Target::App("steam".into())), None),
            (Intent::Launch(Target::App("discord".into())), Some(1)),
        ]
    );
}

#[test]
fn the_grammar_names_only_the_users_ids_and_screens_when_there_are_several() {
    let apps = [n("discord", "Discord"), n("odd\"id", "Odd")];
    let one = grammar(&world(&apps, &[], &[], 1));
    assert!(one.contains(r#"app ::= "discord" | "odd\"id""#), "{one}");
    assert!(!one.contains("ecran"));
    assert!(one.contains(r#"sceneid ::= "\x00""#));
    let two = grammar(&world(&apps, &[], &[], 2));
    assert!(
        two.contains(r#"ouvrir ::= "ouvrir " app (" ecran " [1-2])?"#),
        "{two}"
    );
    let system = system(&world(&apps, &[], &[], 2));
    assert!(system.contains("discord = Discord") && system.contains("« Dis Arya »"));
    assert!(system.contains("l'ordinateur en a 2"));
}

#[test]
fn a_sentence_that_follows_says_so_before_the_sound() {
    let nothing = Context::default();
    let alone = hint(&FollowUp::None, "Dis Arya", &nothing).unwrap();
    assert!(alone.contains("Aucune fenêtre devant") && alone.contains("aucune"));
    let seen = Context {
        front: Some(Front {
            app: Some("discord".into()),
            exe: "Discord.exe".into(),
            title: String::new(),
            screen: Some(2),
        }),
        open: vec!["discord".into(), "steam".into()],
    };
    let with = hint(&FollowUp::None, "Dis Arya", &seen).unwrap();
    assert!(with.contains("Fenêtre devant : discord, écran 2") && with.contains("discord, steam"));
    let other = Context {
        front: Some(Front {
            app: None,
            exe: "chrome.exe".into(),
            title: "YouTube".into(),
            screen: None,
        }),
        open: vec![],
    };
    assert!(hint(&FollowUp::None, "Dis Arya", &other)
        .unwrap()
        .contains("chrome.exe « YouTube »"));
    let called = hint(&FollowUp::Called, "Dis Arya", &nothing).unwrap();
    assert!(called.contains("vient d'appeler Arya"));
    let after = hint(
        &FollowUp::After("musique suivante".into()),
        "Dis Arya",
        &nothing,
    )
    .unwrap();
    assert!(after.contains("Arya vient de faire : musique suivante."));
    assert!(after.contains("appel non"));
    assert_eq!(
        done_lines(
            "appel oui
musique suivante

ouvrir discord ecran 1"
        ),
        "musique suivante, ouvrir discord ecran 1"
    );
}
