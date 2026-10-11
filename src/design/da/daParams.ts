// Types and small builders of the art direction catalogue (split from catalogue.ts so that
// several catalogue files can share them without an import cycle).

export type DaValue = number | boolean | string;
/** Values of one element: `on` plus one entry per parameter. */
export type ElementValues = { readonly on: boolean } & Readonly<Record<string, DaValue>>;
/** Values of every element, by element id. */
export type DaValues = Readonly<Record<string, ElementValues>>;

export interface RangeParam {
  kind: "range";
  key: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}
export interface ToggleParam {
  kind: "toggle";
  key: string;
  default: boolean;
}
export interface SelectParam {
  kind: "select";
  key: string;
  options: readonly string[];
  default: string;
}
/** `""` = the theme's colour; otherwise `#rrggbb`. */
export interface ColorParam {
  kind: "color";
  key: string;
  default: string;
}
export type DaParam = RangeParam | ToggleParam | SelectParam | ColorParam;

export type DaGroup = "fond" | "particules" | "verre" | "interface" | "mouvement" | "historique";
export type DaCost = "faible" | "moyen" | "élevé";

export interface DaElement {
  id: string;
  group: DaGroup;
  cost: DaCost;
  defaultOn: boolean;
  params: readonly DaParam[];
  /** Read by the atmosphere layers (FxLayer.setParams). */
  fx?: true;
  /** CSS variables written on <html>. Called with the element's values, `on` included. */
  css?: (v: ElementValues) => Record<string, string>;
}

export const range = (
  key: string,
  min: number,
  max: number,
  step: number,
  def: number,
  unit?: string,
): RangeParam => ({ kind: "range", key, min, max, step, default: def, unit });
export const toggle = (key: string, def: boolean): ToggleParam => ({
  kind: "toggle",
  key,
  default: def,
});
export const select = (key: string, options: readonly string[], def: string): SelectParam => ({
  kind: "select",
  key,
  options,
  default: def,
});
export const color = (key: string, def = ""): ColorParam => ({ kind: "color", key, default: def });

/** No CSS variable (element off: the stylesheet fallbacks apply). */
export const NONE: Record<string, string> = {};
export const n = (v: ElementValues, k: string) => v[k] as number;
export const px = (v: ElementValues, k: string) => `${n(v, k)}px`;
