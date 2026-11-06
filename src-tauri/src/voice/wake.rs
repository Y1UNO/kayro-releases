//! The wake word, found in what a model heard (the small French one writes « KERO OUVRE STEAM »
//! for « Hé Kayro, ouvre Steam », « DIOUNO OUVRE… » for « Dis Yuna, ouvre… »). Words are compared
//! by how they sound in French, through a rough phonetic key, a vowel weighing half a consonant
//! (models hear vowels loosely), so that the user's own words match however the model spells
//! them, and words that only look alike (« Le Caire », « héros ») do not. What the model heard
//! when the user taught it their word (« Apprendre mon mot d'éveil ») counts as well.

/// Capitals without accents (« é » → E, « ç » → S…), other characters kept as they are.
fn plain(c: char) -> char {
    match c.to_lowercase().next().unwrap_or(c) {
        'é' | 'è' | 'ê' | 'ë' => 'E',
        'à' | 'â' | 'ä' => 'A',
        'î' | 'ï' => 'I',
        'ô' | 'ö' => 'O',
        'ù' | 'û' | 'ü' => 'U',
        'ç' => 'S',
        'œ' => 'E',
        c => c.to_ascii_uppercase(),
    }
}

const VOWELS: [char; 5] = ['A', 'E', 'I', 'O', 'U'];

/// A rough French phonetic key of one word: silent letters dropped, the spellings of one sound
/// merged (« AI », « AY », « EI », « É » → E; « C » before A/O/U, « QU », « Q » → K; « EAU »,
/// « AU » → O; « OU » → U; « PH » → F; « Y » → I…), doubled letters once.
pub fn key(word: &str) -> String {
    let mut s: String = word
        .chars()
        .map(plain)
        .filter(char::is_ascii_alphanumeric)
        .collect();
    for (from, to) in [
        ("EAU", "O"),
        ("AU", "O"),
        ("OU", "U"),
        ("PH", "F"),
        ("QU", "K"),
        ("CK", "K"),
        ("CH", "S"),
    ] {
        s = s.replace(from, to);
    }
    // « C » by the letter after it, before the vowels merge (« CAIRO »: K, then AI → E).
    let chars: Vec<char> = s.chars().collect();
    s = chars
        .iter()
        .enumerate()
        .map(|(i, &c)| match (c, chars.get(i + 1)) {
            ('C', Some('E' | 'I' | 'Y')) => 'S',
            ('C', _) | ('Q', _) => 'K',
            (c, _) => c,
        })
        .collect();
    for (from, to) in [("AY", "E"), ("EY", "E"), ("AI", "E"), ("EI", "E")] {
        s = s.replace(from, to);
    }
    let mut out = String::new();
    for c in s.chars() {
        let c = match c {
            'H' => continue,
            'Y' => 'I',
            c => c,
        };
        if !out.ends_with(c) {
            out.push(c);
        }
    }
    // Silent endings: « -ET », « -ER », « -EZ » sound as E; then a mute final E after a
    // consonant; then a final S, X, T, D, P or Z is not heard.
    for (end, to) in [("ET", "E"), ("ER", "E"), ("EZ", "E")] {
        if out.len() >= 2 && out.ends_with(end) {
            out.truncate(out.len() - end.len());
            out.push_str(to);
        }
    }
    if out.len() > 2 && out.ends_with('E') && !out[..out.len() - 1].ends_with(VOWELS) {
        out.pop();
    }
    if out.len() > 2 && out.ends_with(['S', 'X', 'T', 'D', 'P', 'Z']) {
        out.pop();
    }
    out
}

/// The key of several words said as one (« Dis Yuna » → DIUNA), doubled letters once.
pub fn phrase_key(text: &str) -> String {
    let mut out = String::new();
    for (s, e) in words(text) {
        for c in key(&text[s..e]).chars() {
            if !out.ends_with(c) {
                out.push(c);
            }
        }
    }
    out
}

pub fn levenshtein(a: &str, b: &str) -> usize {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    let mut row: Vec<usize> = (0..=b.len()).collect();
    for (i, ca) in a.iter().enumerate() {
        let mut diag = row[0];
        row[0] = i + 1;
        for (j, cb) in b.iter().enumerate() {
            let up = row[j + 1];
            row[j + 1] = (up + 1).min(row[j] + 1).min(diag + usize::from(ca != cb));
            diag = up;
        }
    }
    row[b.len()]
}

/// How far two keys sound, in half steps: a vowel added, dropped or changed costs 1, a
/// consonant 2.
pub fn sound_distance(a: &str, b: &str) -> usize {
    let cost = |c: char| if VOWELS.contains(&c) { 1 } else { 2 };
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    let mut row: Vec<usize> = std::iter::once(0)
        .chain(b.iter().scan(0, |acc, &c| {
            *acc += cost(c);
            Some(*acc)
        }))
        .collect();
    for &ca in &a {
        let mut diag = row[0];
        row[0] += cost(ca);
        for (j, &cb) in b.iter().enumerate() {
            let up = row[j + 1];
            let change = if ca == cb {
                0
            } else if VOWELS.contains(&ca) && VOWELS.contains(&cb) {
                1
            } else {
                2
            };
            row[j + 1] = (up + cost(ca)).min(row[j] + cost(cb)).min(diag + change);
            diag = up;
        }
    }
    row[b.len()]
}

/// The words of `text` with where each starts and ends (bytes); apostrophes and dashes cut.
pub fn words(text: &str) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    let mut start = None;
    for (i, c) in text.char_indices() {
        if c.is_alphanumeric() {
            start.get_or_insert(i);
        } else if let Some(s) = start.take() {
            out.push((s, i));
        }
    }
    if let Some(s) = start {
        out.push((s, text.len()));
    }
    out
}

/// How far (half steps) what was heard may be from a key of `len` sounds: nothing for a short one
/// (« KERO » must not be « KER », Le Caire) but one vowel heard as another (« IUNO » for « IUNA »),
/// one vowel up to 6, a consonant up to 9, more beyond.
fn allowed(len: usize) -> usize {
    match len {
        0..=4 => 0,
        5..=6 => 1,
        7..=9 => 2,
        _ => 3,
    }
}

/// Same length, one vowel changed into another, nothing else (« IUNO » / « IUNA »).
fn one_vowel_swapped(a: &str, b: &str) -> bool {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    a.len() == b.len()
        && a.iter()
            .zip(&b)
            .filter(|(x, y)| x != y)
            .map(|(x, y)| VOWELS.contains(x) && VOWELS.contains(y))
            .collect::<Vec<_>>()
            == [true]
}

/// How sure a wake word heard is: `Sure` wakes at once; `Maybe` (twice as far) only once the
/// command model also writes it (two looks: a fast or mumbled saying still wakes, a word that
/// only looks alike still does not).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Heard {
    Sure,
    Maybe,
}

/// The user's wake word, ready to be looked for.
#[derive(Debug, Clone)]
pub struct Wake {
    /// The whole phrase's key (« EKERO » for « Hé Kayro »), its most telling word's (« KERO »:
    /// the name alone wakes too, « Yuna » for « Dis Yuna »), and those of what the model heard
    /// when the user taught it.
    keys: Vec<String>,
}

/// A spelling of `wake_word` learned from the user's voice that can be trusted: four sounds at
/// least (« ONA » would wake on « on a gagné »), and still sounding like it (« DIMINA »,
/// « GIUNA »: not a piece of a command, « NA MONTE LE », « ONA OUVREDI SCORDE »).
pub fn learned_ok(heard: &str, wake_word: &str) -> bool {
    let k = phrase_key(heard);
    let name = words(wake_word)
        .into_iter()
        .map(|(s, e)| key(&wake_word[s..e]))
        .max_by_key(String::len)
        .unwrap_or_default();
    let near = sound_distance(&k, &phrase_key(wake_word)).min(sound_distance(&k, &name));
    k.len() >= 4 && near <= 4 && words(heard).len() <= 3
}

impl Wake {
    pub fn new(wake_word: &str, learned: &[String]) -> Option<Self> {
        let phrase = phrase_key(wake_word);
        let name = words(wake_word)
            .into_iter()
            .map(|(s, e)| key(&wake_word[s..e]))
            .max_by_key(String::len)
            .unwrap_or_default();
        let mut keys: Vec<String> = [phrase, name]
            .into_iter()
            .filter(|k| k.len() >= 2)
            .chain(
                learned
                    .iter()
                    .filter(|h| learned_ok(h, wake_word))
                    .map(|h| phrase_key(h)),
            )
            .collect();
        keys.sort();
        keys.dedup();
        (!keys.is_empty()).then_some(Self { keys })
    }

    fn how(&self, heard: &str) -> Option<Heard> {
        let k = phrase_key(heard);
        let mut best = None;
        for w in &self.keys {
            let d = sound_distance(&k, w);
            let allow = allowed(w.len());
            if d <= allow || (w.len() <= 4 && one_vowel_swapped(&k, w)) {
                return Some(Heard::Sure);
            }
            // The looser look: twice as far, and never for a word of three sounds or less.
            if w.len() >= 4 && d <= 2 * allow.max(1) {
                best = Some(Heard::Maybe);
            }
        }
        best
    }

    /// Where the command starts in `text` (bytes, just after the wake word), and how sure it is,
    /// when the wake word is in its first four words: one word, or two or three said together
    /// (« Et Kero, lance… », « DIOUNO OUVRE… », « hé ké ro lance… »). A sure match wins over a
    /// looser one further on.
    pub fn look(&self, text: &str) -> Option<(usize, Heard)> {
        let w = words(text);
        let mut maybe = None;
        for start in 0..w.len().min(4) {
            for end in start..(start + 3).min(w.len()) {
                match self.how(&text[w[start].0..w[end].1]) {
                    Some(Heard::Sure) => return Some((w[end].1, Heard::Sure)),
                    Some(Heard::Maybe) if maybe.is_none() => maybe = Some((w[end].1, Heard::Maybe)),
                    _ => {}
                }
            }
        }
        maybe
    }

    /// Where the command starts, for a sure match beginning in the first `first` words.
    pub fn find_at_start(&self, text: &str, first: usize) -> Option<usize> {
        let w = words(text);
        for start in 0..w.len().min(first) {
            for end in start..(start + 3).min(w.len()) {
                if self.how(&text[w[start].0..w[end].1]) == Some(Heard::Sure) {
                    return Some(w[end].1);
                }
            }
        }
        None
    }

    /// Where the command starts, for a sure match only.
    pub fn find(&self, text: &str) -> Option<usize> {
        self.look(text)
            .and_then(|(at, how)| (how == Heard::Sure).then_some(at))
    }
}

#[cfg(test)]
#[path = "wake_tests.rs"]
mod tests;
