use super::*;

fn named(list: &[(&str, &str)]) -> Vec<Named> {
    list.iter()
        .map(|(id, name)| Named {
            id: (*id).into(),
            name: (*name).into(),
        })
        .collect()
}

fn config() -> (Vec<Named>, Vec<Named>) {
    let apps = named(&[
        ("elden", "Elden Ring"),
        ("discord", "Discord"),
        ("spotify", "Spotify"),
        ("bg3", "Baldur's Gate 3"),
        ("cs2", "Counter-Strike 2"),
        ("steam", "Steam"),
        ("halo-inf", "Halo Infinite"),
        ("halo-mcc", "Halo MCC"),
    ]);
    let scenes = named(&[("soiree", "Soirée jeux")]);
    (apps, scenes)
}

fn app(id: &str) -> Intent {
    Intent::Launch(Target::App(id.into()))
}

#[test]
fn what_parakeet_heard_in_the_trial_launches_the_right_app() {
    let (apps, scenes) = config();
    for (heard, want) in [
        (", lance Elden Ring.", app("elden")),
        (", ouvre Discord.", app("discord")),
        (", ouvre baldure S GAT3.", app("bg3")),
        (", lance Counter Strike 2.", app("cs2")),
        (", ouvre Steam.", app("steam")),
        (
            ", lance la scène soirée jeu.",
            Intent::Launch(Target::Scene("soiree".into())),
        ),
        (", ferme Spotify.", Intent::Close("spotify".into())),
        ("lance le jeu Elden", app("elden")),
    ] {
        assert_eq!(parse(heard, &apps, &scenes), want, "{heard}");
    }
}

#[test]
fn kayro_s_own_actions() {
    let (apps, scenes) = config();
    assert_eq!(parse("ouvre Kayro", &apps, &scenes), Intent::ShowKayro);
    assert_eq!(parse("Ferme Kéro.", &apps, &scenes), Intent::HideKayro);
    assert_eq!(parse("cache-toi", &apps, &scenes), Intent::HideKayro);
    assert_eq!(
        parse("Arrête d'écouter.", &apps, &scenes),
        Intent::StopListening
    );
    assert_eq!(
        parse("coupe le micro", &apps, &scenes),
        Intent::StopListening
    );
    assert_eq!(
        parse("cherche Zelda", &apps, &scenes),
        Intent::Search("zelda".into())
    );
}

#[test]
fn a_doubt_proposes_and_nothing_unknown_starts() {
    let (apps, scenes) = config();
    match parse("lance Halo", &apps, &scenes) {
        Intent::Doubt(candidates) => {
            assert!(candidates.contains(&Target::App("halo-inf".into())));
            assert!(candidates.contains(&Target::App("halo-mcc".into())));
        }
        other => panic!("{other:?}"),
    }
    for heard in ["lance", "", "lance notepad.exe", "ouvre cmd"] {
        assert_eq!(
            parse(heard, &apps, &scenes),
            Intent::NotUnderstood,
            "{heard}"
        );
    }
}

#[test]
fn what_kayro_learned_comes_first_and_only_for_what_is_there() {
    let (apps, scenes) = config();
    let recall = |said: &str| match said {
        "mon foot" => Some(Target::App("cs2".into())),
        "truc" => Some(Target::App("removed".into())),
        _ => None,
    };
    let p = parse_with("lance mon jeu de foot", &apps, &scenes, &[], &recall);
    assert_eq!(p.intent, Intent::Launch(Target::App("cs2".into())));
    assert_eq!(p.said, "mon foot");
    // An app that is no longer in Kayro is never started from memory.
    let p = parse_with("lance truc", &apps, &scenes, &[], &recall);
    assert_eq!(p.intent, Intent::NotUnderstood);
}

#[test]
fn the_users_music_by_name() {
    let (apps, scenes) = config();
    let links = named(&[
        ("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M", "Chill"),
        ("spotify:album:4aawyAB9vmqN3uQ7FjRGTy", "Discovery"),
    ]);
    let p = |heard: &str| parse_with(heard, &apps, &scenes, &links, &|_| None).intent;
    let chill = Intent::Link("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M".into());
    assert_eq!(p("mets ma playlist chill"), chill);
    assert_eq!(p("lance la playlist Chill"), chill);
    assert_eq!(p("mets chill"), chill);
    // « Discord » is an app: « l'album Discovery » is the music only when said so.
    assert_eq!(
        p("ouvre Discord"),
        Intent::Launch(Target::App("discord".into()))
    );
    assert_eq!(
        p("mets l'album Discovery"),
        Intent::Link("spotify:album:4aawyAB9vmqN3uQ7FjRGTy".into())
    );
}

#[test]
fn the_music_and_its_mode() {
    let (apps, scenes) = config();
    let m = |heard: &str| parse(heard, &apps, &scenes);
    for (heard, want) in [
        ("mets pause", Music::Pause),
        ("mais pause", Music::Pause),
        ("m'épouse", Music::Pause),
        ("mets la musique", Music::Play),
        ("reprends", Music::Play),
        ("musique suivante", Music::Next),
        ("la chanson d'après", Music::Next),
        ("musique précédente", Music::Previous),
        ("monte le son", Music::Louder),
        ("moins fort", Music::Quieter),
        ("coupe le son", Music::Mute),
    ] {
        assert_eq!(m(heard), Intent::Music(want), "{heard}");
    }
    assert_eq!(m("mets le mode musique"), Intent::MusicMode(true));
    assert_eq!(m("arrête le mode musique"), Intent::MusicMode(false));
    // An app is still an app, a squashed verb before it too.
    assert_eq!(
        m("lance Spotify"),
        Intent::Launch(Target::App("spotify".into()))
    );
    assert_eq!(
        m("uvo Disco"),
        Intent::Launch(Target::App("discord".into()))
    );
}

#[test]
fn the_wake_part_of_a_learning_sentence() {
    assert_eq!(wake_part("DIOUNOV LANCE SPOTIFY"), "DIOUNOV");
    assert_eq!(wake_part("Et Kero, ouvre Discord."), "Et Kero");
    assert_eq!(wake_part("DIS YOUNA"), "DIS YOUNA");
    assert_eq!(wake_part("UN DEUX TROIS QUATRE"), "UN DEUX TROIS");
}

#[test]
fn numbers_and_glued_digits_read_alike() {
    assert_eq!(normalize("Baldur's GAT3"), "baldur s gat 3");
    assert_eq!(normalize("Counter-Strike II"), "counter strike 2");
    assert_eq!(normalize("Élan, deux"), "elan 2");
}

#[test]
fn politeness_is_left_out() {
    assert_eq!(
        vocab::polite("ouvre discord s il te plait"),
        "ouvre discord"
    );
    assert_eq!(vocab::polite("merci beaucoup ferme steam"), "ferme steam");
    assert_eq!(
        vocab::polite("s il vous plait s il vous plait lance"),
        "lance"
    );
    assert_eq!(vocab::polite("mercier"), "mercier");
}

#[test]
fn a_command_verb_is_known_whatever_its_kind() {
    for w in [
        "lance", "ouvre", "ferme", "coupe", "cache", "cherche", "firm", "cash",
    ] {
        assert!(vocab::is_verb(w), "{w}");
    }
    for w in ["musique", "steam", "pause", ""] {
        assert!(!vocab::is_verb(w), "{w}");
    }
}

#[test]
fn a_short_name_is_known_by_its_first_words_or_its_initials() {
    assert!(by_words("obs", "OBS Studio") >= 0.85);
    assert!(by_words("vs code", "Visual Studio Code") >= 0.9);
    assert!(by_words("vscode", "Visual Studio Code") >= 0.9);
    assert_eq!(by_words("studio", "OBS Studio"), 0.0);
    // A one-word name has no first words nor initials to go by.
    assert_eq!(by_words("disc", "Discord"), 0.0);
}

#[test]
fn a_volume_verb_glued_to_the_wake_word_still_counts() {
    assert_eq!(vocab::music("do winabass le son"), Some(Music::Quieter));
    assert_eq!(vocab::music("duna mont le son"), Some(Music::Louder));
    assert_eq!(vocab::music("bassiste le son"), None);
}
