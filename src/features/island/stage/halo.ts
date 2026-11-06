import type { Drive } from "./disc";
import type { Music } from "./music";
import type { Uniforms } from "./uniforms";

/** The halo, rays and rim for any scene (the lab's `haloStd`). */
export function halo(U: Uniforms, M: Music, d: Drive, H: number, base = 1, rumble = 0): void {
  const dim = (1 - 0.72 * M.build) * (M.gap ? 0.12 : 1);
  const [b, c] = [d.bass, d.crash];
  U.halo[0] =
    ((0.1 +
      0.22 * M.sub * b +
      0.35 * rumble +
      1.0 * M.kick * b +
      0.25 * M.snare +
      1.1 * M.crash * c +
      0.3 * M.tail * c) *
      dim +
      (M.gap ? 0 : 0.45 * M.snare * M.build)) *
    base;
  U.halo[1] = H * (0.032 + 0.05 * M.kick * b + 0.045 * M.crash * c);
  U.halo[2] = (0.45 * M.kick * b + 1.0 * M.crash * c + 0.35 * M.build * M.snare) * base * dim;
  U.halo[3] = 0.35 * M.snare + 0.9 * M.crash * c;
}
