/**
 * CLAUDE.md: at most 6 surfaces with `backdrop-filter` at the same time.
 * Each <Surface> asks for a slot when it mounts; past the limit it renders flat (same look as Eco).
 */
export const MAX_BACKDROP_SURFACES = 6;

let used = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function acquireBackdrop(): boolean {
  if (used >= MAX_BACKDROP_SURFACES) return false;
  used += 1;
  emit();
  return true;
}

export function releaseBackdrop(): void {
  if (used > 0) used -= 1;
  emit();
}

export function backdropInUse(): number {
  return used;
}

export function subscribeBackdrop(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests only. */
export function resetBackdropBudget(): void {
  used = 0;
  emit();
}
