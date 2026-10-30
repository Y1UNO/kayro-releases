/** The installer's visible text (French; ready for other languages like src/i18n). */
const fr = {
  windowTitle: "Installer Kayro",
  minimize: "Réduire",
  close: "Fermer",
  tabInstall: "Installation",
  tabNotes: "Patch notes",
  notesEyebrow: "De l'idée à aujourd'hui",
  notesTitle: "Patch notes",
  notesNow: "Cette version",
  chip: "Version {version} · prétest",
  desktop: "Créer un raccourci sur le bureau",
  factAccount: "S'installe pour ton compte, sans droits administrateur.",
  factOffline: "Fonctionne sans Internet : rien n'est envoyé.",
  "install.eyebrow": "Installation",
  "install.title": "Kayro",
  "install.lead": "Ton lanceur d'applications pour Windows.",
  "install.go": "Installer",
  "update.eyebrow": "Mise à jour",
  "update.title": "Kayro {version}",
  "update.lead":
    "La version {installed} est installée. Tes réglages, tes apps et tes images restent.",
  "update.go": "Mettre à jour",
  "reinstall.eyebrow": "Réinstallation",
  "reinstall.title": "Kayro {version}",
  "reinstall.lead":
    "Cette version est déjà installée. La réinstaller répare Kayro sans toucher à tes réglages.",
  "reinstall.go": "Réinstaller",
  "running.eyebrow": "Avant de continuer",
  "running.title": "Kayro est ouvert",
  "running.lead": "Il va être fermé proprement le temps de l'installation.",
  "running.go": "Fermer Kayro et installer",
  "running.busy": "Fermeture de Kayro…",
  "running.back": "Annuler",
  "stuck.eyebrow": "Avant de continuer",
  "stuck.title": "Kayro ne s'est pas fermé",
  "stuck.lead":
    "Quitte-le avec un clic droit sur son icône, près de l'horloge, puis « Quitter ». Ensuite, réessaie.",
  "stuck.go": "Réessayer",
  "installing.eyebrow": "Installation",
  "installing.title": "Un instant…",
  "installing.lead": "Kayro s'installe. Ça ne prend que quelques secondes.",
  "done.eyebrow": "Terminé",
  "done.title": "Kayro est prêt",
  "done.lead":
    "Tu le retrouves dans le menu Démarrer. Une fois ouvert, Ctrl + Alt + H l'affiche ou le cache à tout moment.",
  "done.go": "Lancer Kayro",
  "failed.eyebrow": "Petit souci",
  "failed.title": "L'installation n'a pas abouti",
  "failed.lead": "L'installeur classique de Windows peut prendre le relais (code {code}).",
  "failed.go": "Ouvrir l'installeur classique",
  "newer.eyebrow": "Déjà installé",
  "newer.title": "Une version plus récente est là",
  "newer.lead":
    "Kayro {installed} est déjà sur ce PC : cet installeur ({version}) ne revient pas en arrière.",
  "missing.eyebrow": "Installeur incomplet",
  "missing.title": "Kayro n'est pas dedans",
  "missing.lead": "Ce fichier ne contient pas Kayro. Redemande-le à la personne qui te l'a envoyé.",
} as const;

export type MessageKey = keyof typeof fr;

/** The text for `key`, with `{name}` replaced by `vars.name`. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return fr[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
