import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button, SegmentedControl, Toggle } from "../../design";
import { t } from "../../i18n";
import type { MessageKey } from "../../i18n";
import { CATEGORY_IDS, CATEGORY_LABELS } from "../home/categories";
import { TARGET_KINDS, type Draft, type TargetKind } from "./draft";
import { isValid, validateDraft, type DraftErrors, type DraftField } from "./validation";
import styles from "./AddApps.module.css";

const KIND_LABELS: Record<TargetKind, MessageKey> = {
  exe: "addApps.manual.kinds.exe",
  lnk: "addApps.manual.kinds.lnk",
  url: "addApps.manual.kinds.url",
  uri: "addApps.manual.kinds.uri",
};
const PLACEHOLDERS: Record<TargetKind, MessageKey> = {
  exe: "addApps.manual.placeholders.exe",
  lnk: "addApps.manual.placeholders.lnk",
  url: "addApps.manual.placeholders.url",
  uri: "addApps.manual.placeholders.uri",
};

/** A refusal that came back from the core (duplicate, invalid…), shown under its field. */
export interface CoreRefusal {
  field: DraftField | null;
  message: string;
}

interface Props {
  initial: Draft;
  /** Editing a launcher's app: only the name, category and favourite can change. */
  lockedTarget?: string | null;
  submitLabel: string;
  /** Returns the core's refusal, or null when it went through. */
  onSubmit: (draft: Draft) => Promise<CoreRefusal | null>;
  /** Extra buttons at the left of the footer (cancel, delete…). */
  extra?: ReactNode;
  /** Reset the fields after a successful submit (add another). */
  resetOnSuccess?: boolean;
  /** Message shown in the footer after a successful submit. */
  successText?: string | null;
}

/** Name, type, target, arguments, category, favourite, "needs admin". Used to add and to edit. */
export function ManualForm({
  initial,
  lockedTarget = null,
  submitLabel,
  onSubmit,
  extra,
  resetOnSuccess = false,
  successText = null,
}: Props) {
  const ids = { name: useId(), target: useId(), args: useId(), category: useId() };
  const [draft, setDraft] = useState<Draft>(initial);
  const [shown, setShown] = useState<ReadonlySet<DraftField>>(new Set());
  const [refusal, setRefusal] = useState<CoreRefusal | null>(null);
  const [busy, setBusy] = useState(false);

  const errors: DraftErrors = lockedTarget ? nameOnly(validateDraft(draft)) : validateDraft(draft);
  const show = (field: DraftField) => shown.has(field);
  const reveal = (field: DraftField) => setShown((s) => new Set(s).add(field));
  const change = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setRefusal(null);
  };
  const messageFor = (field: DraftField): string | null => {
    if (refusal?.field === field) return refusal.message;
    const key = show(field) ? errors[field] : undefined;
    return key ? t(key) : null;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isValid(errors)) {
      setShown(new Set<DraftField>(["name", "target", "args"]));
      return;
    }
    setBusy(true);
    const result = await onSubmit(draft);
    setBusy(false);
    setRefusal(result);
    if (!result && resetOnSuccess) {
      setDraft({ ...initial, kind: draft.kind, category: draft.category });
      setShown(new Set());
    }
  }

  const nameError = messageFor("name");
  const targetError = messageFor("target");
  const argsError = messageFor("args");
  const isExe = draft.kind === "exe";

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.name}>
            {t("addApps.manual.name")}
          </label>
          <input
            id={ids.name}
            className={styles.input}
            value={draft.name}
            maxLength={120}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${ids.name}-e` : undefined}
            onChange={(e) => change({ name: e.target.value })}
            onBlur={() => reveal("name")}
          />
          {nameError && (
            <span id={`${ids.name}-e`} className={styles.error} role="alert">
              {nameError}
            </span>
          )}
        </div>

        {lockedTarget ? (
          <div className={styles.field}>
            <span className={styles.label}>{t("addApps.manual.target")}</span>
            <input className={styles.input} value={lockedTarget} readOnly disabled />
            <span className={styles.hint}>{t("addApps.manual.locked")}</span>
          </div>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.label} id={`${ids.target}-k`}>
                {t("addApps.manual.kind")}
              </span>
              <SegmentedControl
                size="sm"
                label={t("addApps.manual.kind")}
                value={draft.kind}
                options={TARGET_KINDS.map((value) => ({ value, label: t(KIND_LABELS[value]) }))}
                onChange={(kind) => change({ kind })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={ids.target}>
                {t("addApps.manual.target")}
              </label>
              <input
                id={ids.target}
                className={styles.input}
                value={draft.target}
                placeholder={t(PLACEHOLDERS[draft.kind])}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={targetError ? true : undefined}
                aria-describedby={targetError ? `${ids.target}-e` : undefined}
                onChange={(e) => change({ target: e.target.value })}
                onBlur={() => reveal("target")}
              />
              {targetError && (
                <span id={`${ids.target}-e`} className={styles.error} role="alert">
                  {targetError}
                </span>
              )}
            </div>
            {isExe && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={ids.args}>
                  {t("addApps.manual.args")}
                </label>
                <input
                  id={ids.args}
                  className={styles.input}
                  value={draft.args}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={argsError ? true : undefined}
                  aria-describedby={`${ids.args}-h`}
                  onChange={(e) => change({ args: e.target.value })}
                  onBlur={() => reveal("args")}
                />
                <span id={`${ids.args}-h`} className={argsError ? styles.error : styles.hint}>
                  {argsError ?? t("addApps.manual.argsHint")}
                </span>
              </div>
            )}
          </>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.category}>
            {t("addApps.manual.category")}
          </label>
          <select
            id={ids.category}
            className={styles.select}
            value={draft.category}
            onChange={(e) => {
              const value = CATEGORY_IDS.find((id) => id === e.target.value);
              if (value) change({ category: value });
            }}
          >
            {CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>
                {t(CATEGORY_LABELS[id])}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.switchRow}>
          <span className={styles.label} id={`${ids.category}-f`}>
            {t("addApps.manual.favorite")}
          </span>
          <Toggle
            aria-labelledby={`${ids.category}-f`}
            checked={draft.favorite}
            onChange={(favorite) => change({ favorite })}
          />
        </div>

        {!lockedTarget && (
          <div className={styles.switchRow}>
            <div className={styles.field}>
              <span className={styles.label} id={`${ids.category}-a`}>
                {t("addApps.manual.elevated")}
              </span>
              <span className={styles.hint}>
                {isExe ? t("addApps.manual.elevatedHint") : t("addApps.manual.elevatedOnlyExe")}
              </span>
            </div>
            <Toggle
              aria-labelledby={`${ids.category}-a`}
              checked={isExe && draft.elevated}
              disabled={!isExe}
              onChange={(elevated) => change({ elevated })}
            />
          </div>
        )}

        {refusal && refusal.field === null && (
          <span className={styles.error} role="alert">
            {refusal.message}
          </span>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.status} role="status" data-tone="ok">
          {successText}
        </span>
        <div className={styles.actions}>
          {extra}
          <Button variant="primary" type="submit" disabled={busy}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function nameOnly(errors: DraftErrors): DraftErrors {
  return errors.name ? { name: errors.name } : {};
}
