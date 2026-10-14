import styles from "./Atmosphere.module.css";

export interface LayerOptions {
  /** Cadence override (tests); default: the quality budget's. */
  fps?: number;
}

/** Hashed class names of the container's CSS module, from their source names. */
export function cls(names: string): string {
  return names
    .split(" ")
    .map((n) => styles[n] ?? "")
    .join(" ");
}
