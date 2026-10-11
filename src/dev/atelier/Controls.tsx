// Controls of the workshop, generated from the catalogue (src/design/da/catalogue.ts): one block
// per element (with / without switch, reset), one row per parameter.
import type { DaParam, DaValue, DaValues } from "../../design/da";
import { CATALOGUE } from "../../design/da";
import { COSTS, ELEMENT_LABELS, GROUPS, OPTION_LABELS } from "./labels";
import styles from "./Atelier.module.css";

interface Props {
  values: DaValues;
  onChange: (id: string, key: string, value: DaValue) => void;
  onReset: (id: string) => void;
}

function decimals(step: number): number {
  const s = String(step);
  return s.includes(".") ? s.length - s.indexOf(".") - 1 : 0;
}

function ParamRow({
  param,
  label,
  value,
  onChange,
}: {
  param: DaParam;
  label: string;
  value: DaValue;
  onChange: (v: DaValue) => void;
}) {
  switch (param.kind) {
    case "range":
      return (
        <label className={styles.row}>
          <span className={styles.rowLabel}>{label}</span>
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step}
            value={value as number}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className={styles.rowValue}>
            {(value as number).toFixed(decimals(param.step))}
            {param.unit ?? ""}
          </span>
        </label>
      );
    case "toggle":
      return (
        <label className={styles.row}>
          <span className={styles.rowLabel}>{label}</span>
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(e.target.checked)}
          />
        </label>
      );
    case "select":
      return (
        <label className={styles.row}>
          <span className={styles.rowLabel}>{label}</span>
          <select value={value as string} onChange={(e) => onChange(e.target.value)}>
            {param.options.map((o) => (
              <option key={o} value={o}>
                {OPTION_LABELS[o] ?? o}
              </option>
            ))}
          </select>
        </label>
      );
    case "color":
      return (
        <label className={styles.row}>
          <span className={styles.rowLabel}>{label}</span>
          <input
            type="color"
            value={(value as string) || "#ffffff"}
            disabled={value === ""}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className={styles.rowValue}>
            <input
              type="checkbox"
              checked={value === ""}
              title="Couleur du thème"
              onChange={(e) => onChange(e.target.checked ? "" : "#ffffff")}
            />
            thème
          </span>
        </label>
      );
  }
}

export function Controls({ values, onChange, onReset }: Props) {
  const groups = [...new Set(CATALOGUE.map((e) => e.group))];
  return (
    <>
      {groups.map((g) => (
        <section key={g} className={styles.group}>
          <h2 className={styles.groupTitle}>{GROUPS[g] ?? g}</h2>
          {CATALOGUE.filter((e) => e.group === g).map((el) => {
            const v = values[el.id];
            if (!v) return null;
            const label = ELEMENT_LABELS[el.id];
            return (
              <details key={el.id} className={styles.element} data-off={v.on ? undefined : ""}>
                <summary className={styles.elementHead}>
                  <input
                    type="checkbox"
                    checked={v.on}
                    title="Avec / sans"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChange(el.id, "on", e.target.checked)}
                  />
                  <span className={styles.elementName}>{label?.name ?? el.id}</span>
                  <span className={styles.cost} data-cost={el.cost}>
                    {COSTS[el.cost]}
                  </span>
                </summary>
                <p className={styles.role}>{label?.role}</p>
                {el.params.map((p) => (
                  <ParamRow
                    key={p.key}
                    param={p}
                    label={label?.params?.[p.key] ?? p.key}
                    value={v[p.key] ?? p.default}
                    onChange={(nv) => onChange(el.id, p.key, nv)}
                  />
                ))}
                <button type="button" className={styles.small} onClick={() => onReset(el.id)}>
                  Réinitialiser
                </button>
              </details>
            );
          })}
        </section>
      ))}
    </>
  );
}
