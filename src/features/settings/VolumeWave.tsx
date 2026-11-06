import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { t } from "../../i18n";
import { soundWave } from "../../sound";
import type { SoundPackId } from "../../sound/manifest";
import styles from "./VolumeWave.module.css";

const BARS = 44;

interface Props {
  value: number;
  pack: SoundPackId;
  disabled?: boolean;
  labelledBy: string;
  /** Released (pointer up, a key let go): saved and heard. */
  onCommit: (value: number) => void;
}

/**
 * Step 17b, the volume as the wave of the chosen style (its « réussite », rendered offline): the
 * bars grow with the volume, those under it are lit; a native range input on top keeps the
 * keyboard and the screen readers.
 */
export function VolumeWave({ value, pack, disabled, labelledBy, onCommit }: Props) {
  // While dragging, the value under the pointer; otherwise the saved one.
  const [drag, setDrag] = useState<number | null>(null);
  const local = drag ?? value;
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: BARS }, () => 0.2));
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    let live = true;
    void soundWave(pack, "success", BARS).then((b) => live && setBars(b));
    return () => {
      live = false;
    };
  }, [pack]);

  const commit = () => {
    setSweep((n) => n + 1);
    onCommit(local);
    setDrag(null);
  };
  const percent = Math.round(local * 100);

  return (
    <div className={styles.wrap} data-disabled={disabled || undefined}>
      <div className={styles.wave}>
        {bars.map((b, i) => (
          <span
            key={i}
            className={styles.bar}
            aria-hidden="true"
            data-lit={(i + 0.5) / BARS <= local || undefined}
            style={{ "--h": 0.1 + 0.9 * Math.sqrt(b) * (0.45 + 0.55 * local) } as CSSProperties}
          />
        ))}
        {sweep > 0 && <span key={sweep} className={styles.sweep} aria-hidden="true" />}
        <input
          className={styles.range}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={local}
          disabled={disabled}
          aria-labelledby={labelledBy}
          aria-valuetext={t("settings.sounds.volume.value", { percent })}
          onChange={(e) => setDrag(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={(e) => {
            if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") commit();
          }}
        />
      </div>
      <span className={styles.value}>{t("settings.sounds.volume.value", { percent })}</span>
    </div>
  );
}
