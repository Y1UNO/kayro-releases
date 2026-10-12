/**
 * Features that exist only as a place in the interface for now (CLAUDE.md « hors périmètre »):
 * their buttons are hidden, not removed, until the feature is built (round 5, proposal 6).
 */
export const FEATURES = {
  /** Voice commands (microphone button of the top bar and the dock). */
  voice: false,
  /** Hand control (top bar). */
  hands: false,
} as const;
