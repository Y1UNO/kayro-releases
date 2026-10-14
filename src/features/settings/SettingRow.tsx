import { useId } from "react";
import type { ReactNode } from "react";
import { SegmentedControl, Toggle } from "../../design";
import type { SegmentOption } from "../../design/components/SegmentedControl";
import styles from "./Settings.module.css";

interface ChoiceProps<T extends string> {
  label: string;
  help?: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Under the segments (a status, a sub-choice). */
  children?: ReactNode;
}

/** A labelled row with segments (one choice among a few). */
export function ChoiceRow<T extends string>({
  label,
  help,
  value,
  options,
  onChange,
  children,
}: ChoiceProps<T>) {
  const id = useId();
  return (
    <section className={styles.row} data-row="">
      <div className={styles.text}>
        <h3 className={styles.label} id={id}>
          {label}
        </h3>
        {help && <p className={styles.help}>{help}</p>}
      </div>
      <SegmentedControl<T>
        label={label}
        size="sm"
        value={value}
        onChange={onChange}
        options={options}
      />
      {children}
    </section>
  );
}

interface ToggleProps {
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** A labelled on / off row. */
export function ToggleRow({ label, help, checked, disabled, onChange }: ToggleProps) {
  const id = useId();
  return (
    <section className={styles.toggleRow} data-row="">
      <div className={styles.text}>
        <h3 className={styles.label} id={id}>
          {label}
        </h3>
        {help && <p className={styles.help}>{help}</p>}
      </div>
      <Toggle checked={checked} disabled={disabled} aria-labelledby={id} onChange={onChange} />
    </section>
  );
}
