import type { LaunchStyle } from "../../../ipc/bindings";
import { GommageCinema } from "./gommageCinema";
import type { CinemaSetup } from "./glKit";
import type { LaunchScene } from "./scene";
import { SealCinema } from "./sealCinema";

/** The launch scene of a style (30/10): « Sceau » (Hades II), « Gommage » (Clair Obscur). */
export function createScene(style: LaunchStyle, setup: CinemaSetup): LaunchScene | null {
  return style === "gommage" ? GommageCinema.create(setup) : SealCinema.create(setup);
}
