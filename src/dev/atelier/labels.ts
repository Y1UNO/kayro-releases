// French labels of the workshop (dev only: never in a production bundle). One entry per element
// of src/design/da/catalogue.ts; a missing label falls back to the id.

export const GROUPS: Record<string, string> = {
  fond: "Fond",
  particules: "Particules",
  interface: "Interface",
  mouvement: "Mouvement",
  historique: "Croquis (étapes 3 à 12)",
};

export const COSTS: Record<string, string> = {
  faible: "coût faible",
  moyen: "coût moyen",
  élevé: "coût élevé",
};

interface ElementLabel {
  name: string;
  role: string;
  params?: Record<string, string>;
}

export const ELEMENT_LABELS: Record<string, ElementLabel> = {
  backdrop: {
    name: "Fond et vignette",
    role: "Dégradé du thème, vignette, grain",
    params: { shape: "Forme du dégradé", vignette: "Vignette", grain: "Grain" },
  },
  moonHalo: {
    name: "Halo de lune",
    role: "Grand halo doux en haut (couleur A)",
    params: {
      size: "Diamètre",
      top: "Position haute",
      intensity: "Intensité",
      breathe: "Respiration",
      period: "Période",
    },
  },
  veils: {
    name: "Deux voiles",
    role: "Voiles A et B qui dérivent lentement",
    params: {
      intensityA: "Intensité voile A",
      intensityB: "Intensité voile B",
      topA: "Hauteur voile A",
      topB: "Hauteur voile B",
      amplitude: "Amplitude",
      periodA: "Période A",
      periodB: "Période B",
    },
  },
  crystalRing: {
    name: "Anneau cristal (CSS)",
    role: "Anneau fin, filets A/B, reflet tournant, sans pulsation",
    params: {
      size: "Diamètre",
      top: "Position haute",
      offsetX: "Décalage horizontal",
      band: "Épaisseur",
      edge: "Bord clair",
      fringe: "Filets colorés",
      glow: "Lueur",
      spec: "Reflet tournant",
      period: "Durée d'un tour",
      frost: "Verre dépoli (flou de fond)",
    },
  },
  ringGpu: {
    name: "Anneau cristal (GPU)",
    role: "Prototype WebGL2 : réfraction réelle, repli CSS automatique",
    params: {
      refraction: "Réfraction",
      dispersion: "Dispersion",
      blur: "Flou",
      spec: "Reflets",
      quality: "Qualité",
    },
  },
  embers: {
    name: "Braises",
    role: "Braises qui montent (piste P2)",
    params: {
      count: "Nombre",
      size: "Taille",
      rise: "Hauteur de montée",
      life: "Durée de vie",
      glow: "Lueur",
      zoneX: "Centre de la zone",
      zoneW: "Largeur de la zone",
      zoneTop: "Haut de la zone",
      zoneH: "Hauteur de la zone",
      color: "Couleur (vide = B du thème)",
    },
  },
  stars: {
    name: "Étoiles",
    role: "Petites étoiles qui scintillent",
    params: {
      count: "Nombre",
      size: "Taille",
      twinkle: "Scintillement",
      zoneTop: "Haut de la zone",
      zoneH: "Hauteur de la zone",
      color: "Couleur (vide = A du thème)",
    },
  },
  cards: {
    name: "Cartes",
    role: "Taille, coins, bord, voisines, bassin de lumière",
    params: {
      radius: "Rayon des coins",
      activeW: "Largeur carte centrale",
      activeH: "Hauteur carte centrale",
      sideW: "Largeur voisines",
      gap: "Écart",
      dim: "Assombrissement des voisines",
      edge: "Bord de la carte centrale",
      pool: "Bassin de lumière",
    },
  },
  cardHover: {
    name: "Survol des cartes",
    role: "Soulèvement, inclinaison 3D, reflet qui suit la souris",
    params: {
      tilt: "Inclinaison max",
      lift: "Soulèvement",
      duration: "Durée",
      ease: "Courbe",
      sheen: "Reflet",
    },
  },
  glass: {
    name: "Barres de verre",
    role: "Barre du haut, onglets, scènes",
    params: {
      blur: "Flou de fond",
      saturate: "Saturation",
      tint: "Teinte fumée (contraste)",
      border: "Bord",
      highlight: "Reflet du haut",
      shadow: "Ombre",
      pill: "Coins en pilule",
    },
  },
  categoryTitle: {
    name: "Titre de catégorie",
    role: "Grand titre, étiquette, filet dégradé",
    params: {
      size: "Taille",
      weight: "Graisse",
      tracking: "Approche",
      labelTracking: "Approche de l'étiquette",
      underline: "Filet dessous",
      underlineW: "Largeur du filet",
      softLabel: "Étiquette en texte doux",
    },
  },
  typography: {
    name: "Typographies",
    role: "Cormorant + Manrope (Kayro) ou Fraunces + DM Sans",
    params: { pair: "Paire" },
  },
  motion: {
    name: "Mouvement de l'interface",
    role: "Durée et courbe du carrousel",
    params: { card: "Durée des cartes", ease: "Courbe" },
  },
  fog: { name: "Brume (3 ovales)", role: "Brume du croquis" },
  beam: { name: "Faisceau", role: "Faisceau au-dessus de la carte" },
  floor: { name: "Lueur basse", role: "Lueur au ras du dock" },
  cardHalo: { name: "Halo sous la carte", role: "Halo du croquis sous la sélection" },
  dust: { name: "Poussière", role: "Poussière montante du croquis", params: { count: "Nombre" } },
  shine: { name: "Bande de lumière", role: "Reflet qui traverse la carte active" },
};

export const OPTION_LABELS: Record<string, string> = {
  radial: "radial (V4)",
  lineaire: "linéaire (croquis)",
  douce: "douce",
  premium: "premium",
  ressort: "ressort",
  kayro: "Cormorant + Manrope",
  historique: "Fraunces + DM Sans",
  high: "Élevée",
  balanced: "Équilibrée",
  eco: "Éco",
};
