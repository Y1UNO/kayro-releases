import { useMemo, useRef, useState } from "react";
import type { Dispatch, KeyboardEvent } from "react";
import { GripIcon, IconButton, SegmentedControl, Surface, TrashIcon } from "../../design";
import { t } from "../../i18n";
import type { AppEntry, Step } from "../../ipc/bindings";
import type { StepView } from "../../store";
import { useAppIcon } from "../home/useAppIcon";
import { DragGhost } from "../home/Overlays";
import { stepSentence } from "./describe";
import { resolved, type Action, type EditorDraft } from "./draft";
import { RunMark } from "./RunMark";
import { ListMotionState, useListMotion } from "./chain/useListMotion";
import { MAX_SIMPLE_ITEMS, type Sequence } from "./simple";
import { useDrag } from "./useDrag";
import styles from "./Simple.module.css";

type Payload = { kind: "app"; appId: string } | { kind: "move"; from: number };

interface Props {
  draft: EditorDraft;
  apps: readonly AppEntry[];
  dispatch: Dispatch<Action>;
  run: readonly StepView[] | undefined;
}

function Tile({ app }: { app: AppEntry }) {
  const icon = useAppIcon(app);
  return (
    <span className={styles.tile} aria-hidden="true">
      {icon ? <img src={icon} alt={""} draggable={false} /> : app.name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Simple mode: drag apps into « Ma scène » (or press Enter on one), say whether to wait for each,
 * and the steps are written for you. The steps shown below are exactly what will be saved.
 */
export function SimpleEditor({ draft, apps, dispatch, run }: Props) {
  const list = useRef<HTMLOListElement>(null);
  // The whole right column accepts the drop, not only the (possibly short) list.
  const zone = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [announce, setAnnounce] = useState("");
  const { items, sequence } = draft.simple;
  const byId = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
  const inScene = new Set(items.map((i) => i.appId));
  const full = items.length >= MAX_SIMPLE_ITEMS;

  const [listMotion] = useState(() => new ListMotionState());
  const { drag, begin, ignoreClick } = useDrag<Payload>({
    list: zone,
    rows: "[data-item-row]",
    onDrop: (payload, index) => {
      if (index === null) return;
      if (payload.kind === "app") dispatch({ type: "addApp", appId: payload.appId, index });
      else {
        const to = index > payload.from ? index - 1 : index;
        if (to !== payload.from) dispatch({ type: "moveItem", from: payload.from, to });
      }
    },
    onEnd: () => listMotion.snapshot(),
  });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps;
  }, [apps, query]);

  // Apps that come, go and change places move on the "liaison" spring (round 4b).
  useListMotion(list, listMotion, items.map((i) => i.appId).join(" "), drag !== null);

  const { steps, links } = resolved(draft, apps);
  const link = { apps, links };

  function nudge(from: number, delta: number) {
    const to = from + delta;
    if (to < 0 || to >= items.length) return;
    dispatch({ type: "moveItem", from, to });
    setAnnounce(t("scenes.step.moved", { n: from + 1, to: to + 1, total: items.length }));
    requestAnimationFrame(() =>
      list.current?.querySelectorAll<HTMLElement>("[data-item-row] [data-grip]")[to]?.focus(),
    );
  }

  // Arrows on the grip, or Alt + arrows anywhere on the row except its list of modes.
  function onRowKey(e: KeyboardEvent, i: number) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const onGrip = e.target instanceof Element && e.target.closest("[data-grip]") !== null;
    if (!onGrip && !e.altKey) return;
    if (e.target instanceof Element && e.target.closest("select, input")) return;
    e.preventDefault();
    nudge(i, e.key === "ArrowUp" ? -1 : 1);
  }

  const ghostName =
    drag?.payload.kind === "app"
      ? byId.get(drag.payload.appId)?.name
      : drag
        ? byId.get(items[drag.payload.from]?.appId ?? "")?.name
        : undefined;

  return (
    <div className={styles.columns}>
      <Surface radius="var(--radius-2xl)" className={styles.pool}>
        <h2 className={styles.label}>{t("scenes.simple.myApps")}</h2>
        <input
          className={styles.search}
          value={query}
          placeholder={t("scenes.simple.search")}
          aria-label={t("scenes.simple.search")}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className={styles.hint}>{t("scenes.simple.poolHelp")}</p>
        <ul className={styles.poolList}>
          {shown.map((app) => {
            const used = inScene.has(app.id);
            return (
              <li key={app.id}>
                <button
                  type="button"
                  className={styles.poolItem}
                  data-used={used || undefined}
                  disabled={used || full}
                  aria-label={
                    used
                      ? t("scenes.simple.alreadyIn", { name: app.name })
                      : t("scenes.simple.add", { name: app.name })
                  }
                  onPointerDown={(e) => !used && !full && begin(e, { kind: "app", appId: app.id })}
                  onClick={() => {
                    if (ignoreClick()) return;
                    dispatch({ type: "addApp", appId: app.id });
                    setAnnounce(t("scenes.simple.added", { name: app.name }));
                  }}
                >
                  <Tile app={app} />
                  <span className={styles.poolName}>{app.name}</span>
                  <span className={styles.poolState}>{used ? t("scenes.simple.in") : "+"}</span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className={styles.hint}>{t("scenes.simple.noApp")}</li>}
        </ul>
      </Surface>

      <div ref={zone} className={styles.scene}>
        <div className={styles.sceneHead}>
          <h2 className={styles.label}>{t("scenes.simple.myScene", { count: items.length })}</h2>
          <SegmentedControl<Sequence>
            label={t("scenes.simple.sequence")}
            size="sm"
            value={sequence}
            onChange={(s) => dispatch({ type: "sequence", sequence: s })}
            options={[
              { value: "oneByOne", label: t("scenes.simple.oneByOne") },
              { value: "together", label: t("scenes.simple.together") },
            ]}
          />
        </div>

        <ol
          ref={list}
          className={styles.items}
          data-empty={items.length === 0 || undefined}
          data-active={drag !== null || undefined}
          aria-label={t("scenes.simple.myScene", { count: items.length })}
        >
          {items.map((item, i) => {
            const app = byId.get(item.appId);
            if (!app) return null;
            return (
              <li
                key={item.appId}
                className={styles.item}
                data-item-row
                data-row-key={item.appId}
                onKeyDown={(e) => onRowKey(e, i)}
                data-drop-before={drag?.index === i || undefined}
                data-dragging={
                  (drag?.payload.kind === "move" && drag.payload.from === i) || undefined
                }
              >
                <span className={styles.number}>{i + 1}</span>
                <Tile app={app} />
                <span className={styles.itemName}>{app.name}</span>
                <select
                  className={styles.select}
                  aria-label={t("scenes.simple.modeFor", { name: app.name })}
                  value={item.ready ? "ready" : "launch"}
                  onChange={(e) =>
                    dispatch({
                      type: "ready",
                      appId: item.appId,
                      ready: e.target.value === "ready",
                    })
                  }
                >
                  <option value="ready">{t("scenes.simple.launchReady")}</option>
                  <option value="launch">{t("scenes.simple.launchOnly")}</option>
                </select>
                <button
                  type="button"
                  className={styles.grip}
                  data-grip
                  aria-label={t("scenes.step.move", { n: i + 1 })}
                  aria-describedby="scenes-move-help"
                  onPointerDown={(e) => begin(e, { kind: "move", from: i })}
                >
                  <GripIcon size={18} />
                </button>
                <IconButton
                  label={t("scenes.simple.remove", { name: app.name })}
                  size="sm"
                  onClick={() => dispatch({ type: "removeItem", appId: item.appId })}
                >
                  <TrashIcon size={16} />
                </IconButton>
              </li>
            );
          })}
          {items.length === 0 && <li className={styles.emptyZone}>{t("scenes.simple.drop")}</li>}
        </ol>
        {drag?.index === items.length && items.length > 0 && <div className={styles.dropEnd} />}
        <p id="scenes-move-help" className={styles.srOnly}>
          {t("scenes.step.moveHelp")}
        </p>
        <p role="status" className={styles.srOnly}>
          {announce}
        </p>

        <Surface radius="var(--radius-2xl)" className={styles.preview}>
          <h2 className={styles.label}>{t("scenes.simple.preview")}</h2>
          {steps.length === 0 ? (
            <p className={styles.hint}>{t("scenes.simple.previewEmpty")}</p>
          ) : (
            <ol className={styles.previewList}>
              {steps.map((s: Step, i) => (
                <li key={i} className={styles.previewLine}>
                  <span className={styles.previewNumber}>{i + 1}</span>
                  <span className={styles.previewText}>{stepSentence(s, link)}</span>
                  <RunMark view={run?.[i]} />
                </li>
              ))}
            </ol>
          )}
          <p className={styles.hint}>{t("scenes.simple.previewNote")}</p>
        </Surface>
      </div>
      {drag && ghostName && <DragGhost name={ghostName} x={drag.x} y={drag.y} />}
    </div>
  );
}
