import { useRef, useState } from "react";
import type { Dispatch } from "react";
import { PlusIcon } from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import type { StepView } from "../../store";
import { ActionPalette } from "./ActionPalette";
import { DragGhost } from "../home/Overlays";
import { stepRowText } from "./describe";
import { panelSlots, type Action, type EditorDraft } from "./draft";
import { SlotsPanel } from "./SlotsPanel";
import { StepRow } from "./StepRow";
import { useDrag } from "./useDrag";
import side from "./Side.module.css";
import styles from "./Steps.module.css";

interface Props {
  draft: EditorDraft;
  apps: readonly AppEntry[];
  dispatch: Dispatch<Action>;
  run: readonly StepView[] | undefined;
  /** Slot being deleted while some steps use it: the shell asks first. */
  onDeleteSlot: (slot: string) => void;
}

/** The editor of reference/Editeur.dc.html: numbered steps joined by a line, palette, slots. */
export function AdvancedEditor({ draft, apps, dispatch, run, onDeleteSlot }: Props) {
  const list = useRef<HTMLOListElement>(null);
  const [announce, setAnnounce] = useState("");
  const slots = panelSlots(draft, apps);
  const link = { apps, links: draft.links };
  const total = draft.steps.length;

  const { drag, begin } = useDrag<{ from: number }>({
    list,
    rows: "[data-step-row]",
    onDrop: ({ from }, index) => {
      if (index === null) return;
      const to = index > from ? index - 1 : index;
      if (to !== from) dispatch({ type: "moveStep", from, to });
    },
  });

  function nudge(from: number, delta: number) {
    const to = from + delta;
    if (to < 0 || to >= total) return;
    dispatch({ type: "moveStep", from, to });
    setAnnounce(t("scenes.step.moved", { n: from + 1, to: to + 1, total }));
    // Keep the focus on the same step's grip after the list re-renders.
    requestAnimationFrame(() =>
      list.current
        ?.querySelectorAll<HTMLElement>("[data-step-row] button[aria-describedby]")
        [to]?.focus(),
    );
  }

  const dragged = drag ? draft.steps[drag.payload.from] : undefined;

  return (
    <div className={styles.columns}>
      <section className={styles.main} aria-label={t("scenes.steps.label")}>
        <h2 className={styles.label}>{t("scenes.steps.title", { count: total })}</h2>
        <p id="scenes-move-help" className={styles.srOnly}>
          {t("scenes.step.moveHelp")}
        </p>
        <ol ref={list} className={styles.steps}>
          {draft.steps.map((item, i) => (
            <StepRow
              key={item.key}
              index={i}
              total={total}
              item={item}
              link={link}
              slots={slots}
              selected={draft.selected === item.key}
              dropBefore={drag?.index === i}
              dragging={drag?.payload.from === i}
              view={run?.[i]}
              onSelect={() =>
                dispatch({ type: "select", key: draft.selected === item.key ? null : item.key })
              }
              onPatch={(patch) => dispatch({ type: "patchStep", key: item.key, patch })}
              onRemove={() => dispatch({ type: "removeStep", key: item.key })}
              onGripDown={(e) => begin(e, { from: i })}
              onNudge={(d) => nudge(i, d)}
            />
          ))}
        </ol>
        {drag?.index === total && <div className={styles.dropEnd} />}
        {total === 0 && <p className={styles.muted}>{t("scenes.steps.empty")}</p>}
        <button
          type="button"
          className={styles.addStep}
          onClick={() => dispatch({ type: "addStep", kind: "launch" })}
        >
          <PlusIcon size={16} />
          {t("scenes.steps.add")}
        </button>
        <p role="status" className={styles.srOnly}>
          {announce}
        </p>
      </section>

      <aside className={side.sideColumn}>
        <ActionPalette onAdd={(kind) => dispatch({ type: "addStep", kind })} />
        <SlotsPanel
          slots={slots}
          links={draft.links}
          apps={apps}
          onLink={(slot, appId) => dispatch({ type: "link", slot, appId })}
          onAdd={(slot) => dispatch({ type: "addSlot", slot })}
          onDelete={onDeleteSlot}
        />
      </aside>
      {drag && dragged && (
        <DragGhost name={stepRowText(dragged.step, link).title} x={drag.x} y={drag.y} />
      )}
    </div>
  );
}
