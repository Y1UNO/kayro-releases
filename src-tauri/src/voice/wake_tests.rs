use super::*;

#[test]
fn spellings_of_one_sound_share_a_key() {
    for heard in ["Kayro", "KERO", "Kérot", "CAIRO", "Kerrot", "Quéro"] {
        assert_eq!(key(heard), "KERO", "{heard}");
    }
    assert_eq!(key("Hé"), "E");
    assert_eq!(key("Et"), "E");
    assert_eq!(key("Discord"), "DISKOR");
    assert_eq!(key("Youna"), "IUNA");
    assert_eq!(phrase_key("Dis Yuna"), "DIUNA");
}

#[test]
fn a_vowel_weighs_half_a_consonant() {
    assert_eq!(sound_distance("DIUNO", "DIUNA"), 1);
    assert_eq!(sound_distance("KER", "KERO"), 1);
    assert_eq!(sound_distance("KERO", "KEZO"), 2);
    assert_eq!(sound_distance("KERO", "KERO"), 0);
}

fn after<'a>(wake: &Wake, heard: &'a str) -> &'a str {
    let at = wake.find(heard).unwrap_or_else(|| panic!("{heard}"));
    &heard[at..]
}

#[test]
fn the_wake_word_is_found_however_it_is_spelled() {
    let wake = Wake::new("Hé Kayro", &[]).unwrap();
    for (heard, rest) in [
        ("KERO OUVRE STEAM", " OUVRE STEAM"),
        ("Et Kero, lance Elden Ring.", ", lance Elden Ring."),
        ("Kérot, ouvre Steam.", ", ouvre Steam."),
        ("CAIRO OUVRE STEAM", " OUVRE STEAM"),
        ("hé ké ro lance discord", " lance discord"),
    ] {
        assert_eq!(after(&wake, heard), rest);
    }
}

#[test]
fn dis_yuna_as_the_models_heard_it() {
    let wake = Wake::new("Dis YUNA", &[]).unwrap();
    // The streaming model (glued) and Parakeet (cut) on Windows' French voice, 2026-11-04.
    assert_eq!(
        after(&wake, "DIOUNO OUVRE DES SCORDES"),
        " OUVRE DES SCORDES"
    );
    assert_eq!(after(&wake, "Di Une lance Spotify."), " lance Spotify.");
    assert_eq!(
        after(&wake, "Dit Youne, lance la scène soirée jeu."),
        ", lance la scène soirée jeu."
    );
    // « DIOUNOV » is one consonant too far, until the user teaches it.
    assert_eq!(wake.find("DIOUNOV LANCE SPOTIFY"), None);
    let taught = Wake::new("Dis YUNA", &["DIOUNOV".into(), "DIOUNO".into()]).unwrap();
    assert_eq!(after(&taught, "DIOUNOV LANCE SPOTIFY"), " LANCE SPOTIFY");
}

#[test]
fn words_that_only_look_alike_do_not_wake() {
    let kayro = Wake::new("Hé Kayro", &[]).unwrap();
    for heard in [
        "Le Caire est la capitale de l'Égypte.",
        "Quel héros, il a gagné la partie tout seul.",
        "J'ai acheté des carottes et des poireaux au marché.",
        "On se retrouve sur Discord dans dix minutes.",
        "Hier soir j'ai joué à Elden Ring avec Thomas, Kayro.",
    ] {
        assert_eq!(kayro.find(heard), None, "{heard}");
    }
    let yuna = Wake::new("Dis Yuna", &[]).unwrap();
    for heard in [
        "TU AS VU LE FILM AVEC LUNO HIER SOIR",
        "DIS DONC TU VIENS CE SOIR",
        "Dis donc, tu viens ce soir?",
    ] {
        assert_eq!(yuna.find(heard), None, "{heard}");
    }
}

#[test]
fn any_wake_word_of_the_user_works() {
    let wake = Wake::new("Ok Jarvis", &[]).unwrap();
    assert!(wake.find("OK JARVIS LANCE STEAM").is_some());
    assert!(wake.find("OKAY JARVICE LANCE STEAM").is_some());
    assert!(wake.find("LANCE STEAM").is_none());
    assert!(Wake::new("!!", &[]).is_none());
}

#[test]
fn a_wake_word_said_again_is_skipped() {
    use crate::voice::phrase::command_of;
    let w = Wake::new("Dis Yuna", &[]).unwrap();
    let said = command_of(&w, "Yuna Dis Yuna ferme Spotify.", "");
    assert_eq!(said.trim_start_matches([',', ' ']), "ferme Spotify.");
    let once = command_of(&w, "Dis Yuna, ouvre Discord.", "");
    assert_eq!(once.trim_start_matches([',', ' ']), "ouvre Discord.");
}

#[test]
fn a_learned_spelling_too_short_or_too_long_is_not_trusted() {
    assert!(!learned_ok("ONA", "Dis Yuna"));
    assert!(!learned_ok("ONA OUVREDI SCORDE", "Dis Yuna"));
    assert!(learned_ok("GIHUNA", "Dis Yuna"));
    assert!(learned_ok("GI OUNA", "Dis Yuna"));
    assert!(learned_ok("DIMINA", "Dis Yuna"));
    assert!(learned_ok("DUNA", "Dis Yuna"));
    assert!(!learned_ok("NA MONTE LE", "Dis Yuna"));
    assert!(!learned_ok("NAOULOS", "Dis Yuna"));
    let w = Wake::new("Dis Yuna", &["ONA".into(), "GIHUNA".into()]).unwrap();
    assert!(w.find("ON A GAGNE").is_none());
    assert!(w.find("GIHUNA LANCE STEAM").is_some());
}
