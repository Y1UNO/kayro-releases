import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { GripIcon, IconButton, TrashIcon } from "../../design";
import { t } from "../../i18n";
import type { Step } from "../../ipc/bindings";
import type { StepView } from "../../store";
import { KIND_LABELS, stepRowText, type Linking } from "./describe";
import type { DraftStep } from "./draft";
import { MAX_WAIT_MS, parseSeconds, slotLabel } from "./model";
import { RunMark } from "./RunMark";
import type { ChainLink } from "./chain/chainState";
import chainStyles from "./chain/Chain.module.css";
import styles from "./Steps.module.css";

interface Props {
  index: number;
  total: number;
  item: DraftStep;
  link: Linking;
  slots: readonly string[];
  selected: boolean;
  dragging: boolean;
  /** Vertical shift while a drag is going on (px): the carried card, or a neighbour making room. */
  shiftY: number;
  view: StepView | undefined;
  /** Its point and the thread to the next one (round 4b chain). */
  chain: ChainLink;
  hasNext: boolean;
  onSelect: () => void;
  onPatch: (patch: Partial<Step>) => void;
  onRemove: () => void;
  onGripDown: (e: PointerEvent) => void;
  /** Arrow keys on the grip, or Alt + arrows on the row: -1 up, +1 down; where the focus goes. */
  onNudge: (delta: number, focus: "grip" | "body") => void;
}

const FIELDS = "input, select, textarea";

const seconds = (ms: number) => String(Math.round(ms) / 1000).replace(".", ",");

/** One numbered step: kind badge, title, sub-line, grip. The selected step opens its settings. */
export function StepRow(p: Props) {
  const { step } = p.item;
  const text = stepRowText(step, p.link);
  const tone = step.type === "wait" || step.type === "waitReady" ? "wait" : "go";

  function onGripKey(e: KeyboardEvent) {
    if (e.altKey) return; // the row's Alt + arrows
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      p.onNudge(e.key === "ArrowUp" ? -1 : 1, "grip");
    }
  }

  // Alt + arrows move the step from anywhere on the row (not from its fields).
  function onRowKey(e: KeyboardEvent) {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    if (e.target instanceof Element && e.target.closest(FIELDS)) return;
    e.preventDefault();
    const onGrip = e.target instanceof Element && e.target.closest("[aria-describedby]") !== null;
    p.onNudge(e.key === "ArrowUp" ? -1 : 1, onGrip ? "grip" : "body");
  }

  return (
    <li
      className={`${styles.step} ${chainStyles.lit}`}
      style={p.shiftY ? ({ translate: `0 ${p.shiftY}px` } as CSSProperties) : undefined}
      data-step-row
      data-row-key={p.item.key}
      data-run={p.chain.point}
      data-selected={p.selected || undefined}
      data-dragging={p.dragging || undefined}
      data-warn={text.warn || undefined}
      onKeyDown={onRowKey}
    >
      {p.hasNext && (
        <span className={chainStyles.seg} data-chain-seg aria-hidden="true">
          <span className={chainStyles.fill} data-on={p.chain.filled || undefined} />
        </span>
      )}
      <div className={styles.stepMain}>
        {/* Round 5 (proposal 4): the handle on the left of the number. */}
        <button
          type="button"
          className={styles.grip}
          aria-label={t("scenes.step.move", { n: p.index + 1 })}
          aria-describedby="scenes-move-help"
          onPointerDown={p.onGripDown}
          onKeyDown={onGripKey}
        >
          <GripIcon size={18} />
        </button>
        <span
          className={`${styles.stepNumber} ${chainStyles.point}`}
          data-chain-point
          data-point={p.chain.point}
        >
          {p.index + 1}
        </span>
        <button
          type="button"
          className={styles.stepBody}
          data-step-body
          aria-expanded={p.selected}
          onClick={p.onSelect}
        >
          <span className={styles.badge} data-tone={tone}>
            {t(KIND_LABELS[step.type])}
          </span>
          <span className={styles.stepText}>
            <span className={styles.stepTitle}>{text.title}</span>
            <span className={styles.stepSub} data-warn={text.warn || undefined}>
              {text.sub}
            </span>
          </span>
        </button>
        <RunMark view={p.view} />
      </div>
      {p.selected && (
        <div className={styles.details}>
          {"slot" in step && (
            <label className={styles.field}>
              <span>{t("scenes.step.slot")}</span>
              <select
                className={styles.select}
                value={step.slot}
                onChange={(e) => p.onPatch({ slot: e.target.value } as Partial<Step>)}
              >
                {p.slots.map((s) => (
                  <option key={s} value={s}>
                    {slotLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {step.type === "wait" && (
            <SecondsField
              label={t("scenes.step.delay")}
              ms={step.ms}
              min={0}
              onCommit={(ms) => p.onPatch({ ms })}
            />
          )}
          {step.type === "waitReady" && (
            <SecondsField
              label={t("scenes.step.timeout")}
              ms={step.timeoutMs}
              min={1000}
              onCommit={(timeoutMs) => p.onPatch({ timeoutMs })}
            />
          )}
          {step.type !== "wait" && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={step.required ?? false}
                onChange={(e) => p.onPatch({ required: e.target.checked })}
              />
              <span>{t("scenes.step.required")}</span>
            </label>
          )}
          <IconButton
            label={t("scenes.step.remove", { n: p.index + 1 })}
            size="sm"
            onClick={p.onRemove}
          >
            <TrashIcon size={16} />
          </IconButton>
        </div>
      )}
    </li>
  );
}

function SecondsField({
  label,
  ms,
  min,
  onCommit,
}: {
  label: string;
  ms: number;
  min: number;
  onCommit: (ms: number) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        key={ms}
        className={styles.select}
        inputMode="decimal"
        defaultValue={seconds(ms)}
        onBlur={(e) => {
          const next = parseSeconds(e.target.value, min, MAX_WAIT_MS);
          if (next === null) e.target.value = seconds(ms);
          else if (next !== ms) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
