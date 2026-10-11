// "Mesurer" of the workshop: 10 s of frame times inside each preview (idle, no input) and the
// CPU / GPU of the whole app process tree (scripts/measure-cost.ps1, only meaningful when the
// workshop runs in the Tauri window), compared with the budgets of PLAN.md §5 / step 8.
import type { Quality } from "../../design";
import type { BenchResult } from "../bench";
import type { Side } from "./sync";
import styles from "./Atelier.module.css";

export interface Cost {
  process?: string;
  procs?: number;
  cpu?: number;
  gpu3d?: number;
  gpuSamples?: number;
  error?: string;
}

/** Visible CPU budget, % of the machine (PLAN.md §5, decided 09/10). */
const CPU_BUDGET: Record<Quality, number> = { eco: 4, balanced: 4, high: 8, ultra: 8 };
/** GPU budget, High level, 1440p (PLAN.md §5). */
const GPU_BUDGET = 15;

function verdict(ok: boolean): string {
  return ok ? "✅" : "❌";
}

interface Props {
  quality: Quality;
  bench: Partial<Record<Side, BenchResult>>;
  cost: Cost | null;
  measuring: boolean;
  onMeasure: () => void;
}

export function Measures({ quality, bench, cost, measuring, onMeasure }: Props) {
  return (
    <div className={styles.measures}>
      <button type="button" className={styles.small} disabled={measuring} onClick={onMeasure}>
        {measuring ? "Mesure en cours (10 s)…" : "Mesurer (10 s)"}
      </button>
      {(Object.entries(bench) as [Side, BenchResult][]).map(([s, b]) => {
        const budget = 1.5 * (1000 / (b.hz || 60));
        return (
          <p key={s}>
            {s} · {b.hz} Hz · p50 {b.p50.toFixed(1)} ms · p95 {b.p95.toFixed(1)} ms{" "}
            {verdict(b.p95 <= budget)} (≤ {budget.toFixed(1)}) · perdues {b.dropped}/{b.frames}
          </p>
        );
      })}
      {cost &&
        (cost.error ? (
          <p>
            CPU/GPU non mesurés :{" "}
            {cost.error === "app not running" ? "app Tauri non lancée" : cost.error}
          </p>
        ) : (
          <p>
            Arbre {cost.process} ({cost.procs} proc.) · CPU {cost.cpu?.toFixed(2)} %{" "}
            {verdict((cost.cpu ?? 99) < CPU_BUDGET[quality])} (&lt; {CPU_BUDGET[quality]} %) · GPU{" "}
            {cost.gpu3d !== undefined && cost.gpu3d >= 0
              ? `${cost.gpu3d.toFixed(1)} % ${verdict(cost.gpu3d < GPU_BUDGET)} (< ${GPU_BUDGET} %, ${cost.gpuSamples} éch.)`
              : "non mesuré"}
          </p>
        ))}
    </div>
  );
}
