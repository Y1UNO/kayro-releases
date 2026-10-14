import { useRef, useState } from "react";
import type { CSSProperties, Dispatch, PointerEvent } from "react";
import { PlusIcon } from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { useMotionTokens } from "../../design/motion/current";
import type { StepView } from "../../store";
import { ActionPalette } from "./ActionPalette";
import { chainState } from "./chain/chainState";
import { ListMotionState, useListMotion } from "./chain/useListMotion";
import { panelSlots, type Action, type EditorDraft } from "./draft";
import { SlotsPanel } from "./SlotsPanel";
import { StepRow } from "./StepRow";
import { useDrag } from "./useDrag";
import chainStyles from "./chain/Chain.module.css";
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

/**
 * The editor of reference/Editeur.dc.html: numbered steps joined by a line, palette, slots. The
 * steps form a chain of points (round 4b): they come, go and change places on the "liaison"
 * spring (useListMotion), the neighbours make room during a drag, and a test lights the points one
 * by one (chainState).
 */
export function AdvancedEditor({ draft, apps, dispatch, run, onDeleteSlot }: Props) {
  const list = useRef<HTMLOListElement>(null);
  const [announce, setAnnounce] = useState("");
  const slots = panelSlots(draft, apps);
  const link = { apps, links: draft.links };
  const total = draft.steps.length;
  const motion = useMotionTokens();
  const chain = chainState(total, run);
  // Where the drag started, and how far a neighbour moves to make room (the carried row + gap).
  const [carried, setCarried] = useState({ startY: 0, room: 0 });

  const [listMotion] = useState(() => new ListMotionState());
  const { drag, begin } = useDrag<{ from: number }>({
    list,
    rows: "[data-step-row]",
    onDrop: ({ from }, index) => {
      if (index === null) return;
      const to = index > from ? index - 1 : index;
      if (to !== from) dispatch({ type: "moveStep", from, to });
    },
    onEnd: () => listMotion.snapshot(),
  });

  // The rows move when steps come, go, change places, or when the step that opens changes.
  const layoutKey = `${draft.steps.map((s) => s.key).join(" ")}|${draft.selected ?? ""}`;
  useListMotion(list, listMotion, layoutKey, drag !== null);

  function nudge(from: number, delta: number, focus: "grip" | "body") {
    const to = from + delta;
    if (to < 0 || to >= total) return;
    dispatch({ type: "moveStep", from, to });
    setAnnounce(t("scenes.step.moved", { n: from + 1, to: to + 1, total }));
    // Keep the focus on the same step (its grip, or its row) after the list re-renders.
    const target = focus === "grip" ? "button[aria-describedby]" : "[data-step-body]";
    requestAnimationFrame(() =>
      list.current?.querySelectorAll<HTMLElement>(`[data-step-row] ${target}`)[to]?.focus(),
    );
  }

  function grab(e: PointerEvent, from: number) {
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-step-row]");
    const gap = list.current ? parseFloat(getComputedStyle(list.current).rowGap) || 0 : 0;
    setCarried({ startY: e.clientY, room: (row?.offsetHeight ?? 0) + gap });
    begin(e, { from });
  }

  /** Shift of row `i` while a drag goes on: the carried one follows the pointer. */
  function shiftOf(i: number): number {
    if (!drag) return 0;
    const from = drag.payload.from;
    if (i === from) return drag.y - carried.startY;
    const at = drag.index;
    const to = at === null ? from : at > from ? at - 1 : at;
    if (from < i && i <= to) return -carried.room;
    if (to <= i && i < from) return carried.room;
    return 0;
  }

  return (
    <div className={styles.columns}>
      <section className={styles.main} aria-label={t("scenes.steps.label")}>
        <h2 className={styles.label}>{t("scenes.steps.title", { count: total })}</h2>
        <p id="scenes-move-help" className={styles.srOnly}>
          {t("scenes.step.moveHelp")}
        </p>
        <ol
          ref={list}
          className={`${styles.steps} ${drag ? chainStyles.dragging : ""}`}
          style={{ "--chain-active": motion.chain.active } as CSSProperties}
        >
          {draft.steps.map((item, i) => (
            <StepRow
              key={item.key}
              index={i}
              total={total}
              item={item}
              link={link}
              slots={slots}
              selected={draft.selected === item.key}
              dragging={drag?.payload.from === i}
              shiftY={shiftOf(i)}
              view={run?.[i]}
              chain={chain[i]!}
              hasNext={i < total - 1}
              onSelect={() =>
                dispatch({ type: "select", key: draft.selected === item.key ? null : item.key })
              }
              onPatch={(patch) => dispatch({ type: "patchStep", key: item.key, patch })}
              onRemove={() => dispatch({ type: "removeStep", key: item.key })}
              onGripDown={(e) => grab(e, i)}
              onNudge={(d, focus) => nudge(i, d, focus)}
            />
          ))}
        </ol>
        {/* Empty chain: a dotted zone that adds the first step (its point comes on the spring). */}
        <button
          type="button"
          className={`${styles.addStep} ${total === 0 ? chainStyles.emptyAdd : ""}`}
          onClick={() => dispatch({ type: "addStep", kind: "launch" })}
        >
          <PlusIcon size={16} />
          {total === 0 ? t("scenes.steps.empty") : t("scenes.steps.add")}
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
    </div>
  );
}
