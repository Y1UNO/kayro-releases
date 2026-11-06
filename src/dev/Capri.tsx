import { CapriSheet } from "../features/update/CapriSheet";

/** Development only (`/dev/capri`): the Capri patch notes page with sample notes. */
export default function CapriDev() {
  return (
    <div style={{ height: "100vh", background: "linear-gradient(160deg,#2a2250,#0c0a1a)" }}>
      <CapriSheet
        open
        eyebrow="Mise à jour disponible"
        title="Kayro 0.21.0"
        sub="Tu es en 0.20.0. Tes réglages, tes apps et tes images restent."
        points={[
          "Le widget devient Kysland, une île noire collée au haut de l'écran.",
          "La musique en cours : pochette en vinyle qui tourne, barres au rythme.",
          "Clique dessus : recherche, musique, passage en immersif.",
        ]}
        primary="Installer et redémarrer"
        onPrimary={() => {}}
        secondary="Plus tard"
        onSecondary={() => {}}
        onClose={() => {}}
      />
    </div>
  );
}
