// Round 4b part of the motion lab (`/dev/motion`, dev only): the scene editor's chain of points
// (add, remove, swap 2 and 3, test, test with a failure) on the real advanced editor, the empty
// category's card, and a launch that fails (the card shakes, the message offers « Corriger »).
// Texts are not translated on purpose (dev page).
import { useReducer, useRef, useState } from "react";
import { Button } from "../design";
import { currentMotion } from "../design/motion/current";
import { EmptyState } from "../features/home/EmptyState";
import { AdvancedEditor } from "../features/scenes/AdvancedEditor";
import { draftFromScene, reduce } from "../features/scenes/draft";
import type { AppEntry, SceneFile } from "../ipc/bindings";
import { hubStore, type StepView } from "../store";
import styles from "./MotionLab.module.css";

const DEMO: SceneFile = {
  schemaVersion: 1,
  id: "demo",
  name: "Démo",
  steps: [
    { type: "launch", slot: "messagerie" },
    { type: "wait", ms: 2000 },
    { type: "launch", slot: "jeux" },
    { type: "focus", slot: "jeux" },
  ],
};

/** Plays the demo chain at the demo pace: a step « Lancer » 520 ms, « Attendre » 900 ms. */
function useFakeTest(steps: () => SceneFile["steps"]) {
  const [run, setRun] = useState<StepView[] | undefined>(undefined);
  const timer = useRef(0);
  function play(failAt: number | null) {
    window.clearTimeout(timer.current);
    const list = steps();
    const views: StepView[] = list.map(() => ({ state: "pending", reason: null }));
    const pace = currentMotion().chain;
    const tick = (i: number) => {
      if (i > 0) {
        const failed = i - 1 === failAt;
        views[i - 1] = failed
          ? { state: "failed", reason: "launchNotFound" }
          : { state: "ok", reason: null };
        if (failed) {
          for (let k = i; k < list.length; k++) views[k] = { state: "skipped", reason: null };
          return setRun([...views]);
        }
      }
      if (i === list.length) return setRun([...views]);
      views[i] = { state: "running", reason: null };
      setRun([...views]);
      const ms = list[i]!.type === "wait" ? pace.demoWait : pace.demoLaunch;
      timer.current = window.setTimeout(() => tick(i + 1), ms);
    };
    tick(0);
  }
  function stop() {
    window.clearTimeout(timer.current);
    setRun(undefined);
  }
  return { run, play, stop };
}

export function MotionLab4b({ apps, failingApp }: { apps: AppEntry[]; failingApp: string }) {
  const [draft, dispatch] = useReducer(reduce, undefined, () =>
    draftFromScene(DEMO, { messagerie: apps[0]!.id, jeux: apps[1]!.id }, apps),
  );
  const test = useFakeTest(() => draft.steps.map((s) => s.step));
  const change = (action: Parameters<typeof dispatch>[0]) => {
    test.stop();
    dispatch(action);
  };

  return (
    <>
      <section className={styles.block}>
        <h2 className={styles.h}>4b · chaîne de points (éditeur avancé, niveau 2)</h2>
        <div className={styles.row}>
          <Button onClick={() => change({ type: "addStep", kind: "launch" })}>Ajouter</Button>
          <Button
            disabled={draft.steps.length === 0}
            onClick={() =>
              change({
                type: "removeStep",
                key: draft.selected ?? draft.steps[draft.steps.length - 1]!.key,
              })
            }
          >
            Retirer
          </Button>
          <Button
            disabled={draft.steps.length < 3}
            onClick={() => change({ type: "moveStep", from: 1, to: 2 })}
          >
            Échanger 2 et 3
          </Button>
          <Button variant="primary" onClick={() => test.play(null)}>
            Tester
          </Button>
          <Button onClick={() => test.play(1)}>Tester avec échec (étape 2)</Button>
        </div>
        <p className={styles.hint}>
          Alt + flèches sur une étape pour la déplacer ; glisser la poignée : les voisines font de
          la place. Rythme de démo 520 / 900 ms (un vrai test suit les vraies étapes).
        </p>
        <AdvancedEditor
          draft={draft}
          apps={apps}
          dispatch={change}
          run={test.run}
          onDeleteSlot={() => {}}
        />
      </section>

      <section className={styles.block}>
        <h2 className={styles.h}>4b · états — catégorie vide, lancement qui échoue</h2>
        <div className={styles.row}>
          <Button
            onClick={() =>
              hubStore.setState({
                lastError: { code: "launchNotFound", message: "", field: null },
                failedApp: failingApp,
              })
            }
          >
            Simuler l’échec de la carte centrale
          </Button>
        </div>
        <EmptyState scope="category" onAdd={() => {}} />
      </section>
    </>
  );
}
