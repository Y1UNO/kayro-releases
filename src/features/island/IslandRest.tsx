import { Logo } from "../../brand";
import type { AppEntry, NowPlaying } from "../../ipc/bindings";
import { t } from "../../i18n";
import { AppMark } from "./AppMark";
import { trackKey } from "./music";
import type { Stretch } from "./useIslandData";
import styles from "./IslandRest.module.css";

interface Props {
  np: NowPlaying | null;
  /** What stretches it for a moment: an app that starts, or a message of Kayro's own. */
  launch: Stretch | null;
  running: readonly AppEntry[];
  onFront: (app: AppEntry) => void;
}

/** The running apps' dots shown on hover, at most. */
export const DOTS_MAX = 8;

/**
 * Step 20 (Kysland): what the island shows at rest, inside its black shape. The music (its
 * cover as a small record turning while it plays, bars moving with the beat), a launch (the
 * app's logo and name for a moment), and on hover the running apps' dots (a click brings one to
 * the front). Their opacities come from the engine (`--rest-*`), the beat from `useBeat`.
 */
export function IslandRest({ np, launch, running, onFront }: Props) {
  return (
    <div className={styles.rest}>
      <div className={styles.music} aria-hidden="true">
        <span className={styles.vinyl} data-playing={np?.playing || undefined}>
          {np?.cover && <img key={trackKey(np)} src={np.cover} alt={""} draggable={false} />}
        </span>
        <span className={styles.bars}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className={styles.launch} aria-live="polite">
        {launch && (
          <>
            {launch.app ? <AppMark app={launch.app} size={22} /> : <Logo size={22} />}
            <span className={styles.launchName}>{launch.text}</span>
          </>
        )}
      </div>
      <div className={styles.dots}>
        {running.slice(0, DOTS_MAX).map((app, k) => (
          <button
            key={app.id}
            type="button"
            className={styles.dot}
            data-dot
            style={{ "--k": k } as React.CSSProperties}
            aria-label={t("island.front", { name: app.name })}
            tabIndex={-1}
            onClick={() => onFront(app)}
          >
            <AppMark app={app} size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
