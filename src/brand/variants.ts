import data from "../assets/brand/variantes.json";

export interface LogoVariant {
  id: string;
  /** Display name (French). */
  nom: string;
  haut: string;
  bas: string;
  symbole: string;
  contraste_min: number;
}

interface VariantFile {
  defaut: string;
  variables: { haut: string; bas: string; symbole: string };
  contraste_min_requis: number;
  variantes: LogoVariant[];
}

const file: VariantFile = data;

export const LOGO_VARIANTS: readonly LogoVariant[] = file.variantes;
export const LOGO_VARS = file.variables;
export const MIN_LOGO_CONTRAST = file.contraste_min_requis;

export function findVariant(id: string): LogoVariant | undefined {
  return LOGO_VARIANTS.find((v) => v.id === id);
}

export const DEFAULT_LOGO_VARIANT: LogoVariant = findVariant(file.defaut) ?? LOGO_VARIANTS[0]!;
