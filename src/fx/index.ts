// Public surface of the atmosphere. Screens (`features/`) import from here only.
export { Atmosphere, themePalette } from "./Atmosphere";
export { createFx, clampIntensity, INTENSITY_MIN, INTENSITY_MAX } from "./createFx";
export type { FxLayer, FxPalette, FxParams, FxTarget } from "./FxLayer";
export { frameLoop } from "./loop";
export { useFxTarget, targetOf } from "./target";
