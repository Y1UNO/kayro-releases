//! What the next sentence may follow (the always mode with the brain, listen.rs): after
//! « Arya… » alone, the next sentence is addressed to it for a few seconds; after something done,
//! a sentence may go on with it without the name for a while (« change la musique »… « en fait,
//! reviens à la précédente »; the brain judges, and each sentence understood starts the window
//! again). The aura stays lit while a window is open. Pure decisions, so that they can be tested.

use std::time::{Duration, Instant};

use super::brain::prompt::FollowUp;
use super::think::Thought;

/// After the assistant was called with nothing asked (« Arya… »), the next sentence is its
/// follow-up for this long.
pub const CALLED: Duration = Duration::from_secs(8);
/// After something was done, the next sentence may go on with it without the name for this long.
pub const CONVERSATION: Duration = Duration::from_secs(15);

/// An open window: what the next sentence may follow, until when.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Follow {
    pub what: FollowUp,
    pub until: Instant,
}

impl Follow {
    pub fn expired(&self, now: Instant) -> bool {
        now >= self.until
    }
}

/// The window after the brain answered a sentence that followed `before` (taken: a sentence
/// closes the window it followed unless it is kept here).
pub fn next(before: Option<Follow>, thought: &Thought, now: Instant) -> Option<Follow> {
    match thought {
        // Said to someone else: what it followed may still be followed, until the same moment.
        Thought::NotCalled => before,
        // « Arya… » alone: the command comes next.
        Thought::Done { asked: 0, .. } if before.is_none() => Some(Follow {
            what: FollowUp::Called,
            until: now + CALLED,
        }),
        // « Merci », « ok » after something done, or nothing asked after a call: nothing more.
        Thought::Done { asked: 0, .. } => None,
        Thought::Done { done, .. } => Some(Follow {
            what: FollowUp::After(done.clone()),
            until: now + CONVERSATION,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn done(asked: usize, lines: &str) -> Thought {
        Thought::Done {
            asked,
            done: lines.into(),
        }
    }

    #[test]
    fn a_bare_call_opens_a_short_window_once() {
        let now = Instant::now();
        let f = next(None, &done(0, ""), now).unwrap();
        assert_eq!((&f.what, f.until), (&FollowUp::Called, now + CALLED));
        // Nothing asked during it (a breath, « euh »): it closes rather than staying lit.
        assert_eq!(next(Some(f), &done(0, ""), now), None);
    }

    #[test]
    fn something_done_opens_a_conversation_with_what_was_done() {
        let now = Instant::now();
        let f = next(None, &done(2, "musique suivante, volume plus"), now).unwrap();
        assert_eq!(
            f.what,
            FollowUp::After("musique suivante, volume plus".into())
        );
        assert_eq!(f.until, now + CONVERSATION);
        // A sentence understood during it starts the window again, with what it did.
        let later = now + Duration::from_secs(10);
        let g = next(Some(f), &done(1, "musique precedente"), later).unwrap();
        assert_eq!(g.what, FollowUp::After("musique precedente".into()));
        assert_eq!(g.until, later + CONVERSATION);
    }

    #[test]
    fn chatter_keeps_the_window_and_thanks_close_it() {
        let now = Instant::now();
        let f = next(None, &done(1, "ouvrir discord"), now).unwrap();
        // « Tu as vu le match hier soir ? »: said to someone else, the same window stays.
        assert_eq!(
            next(Some(f.clone()), &Thought::NotCalled, now),
            Some(f.clone())
        );
        // « Merci. »: addressed to the assistant, nothing asked.
        assert_eq!(next(Some(f), &done(0, ""), now), None);
        assert!(Follow {
            what: FollowUp::Called,
            until: now
        }
        .expired(now));
    }
}
