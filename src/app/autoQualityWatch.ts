import { autoQualityStore } from "../design/autoQualityStore";
import { AutoQuality } from "../fx/autoQuality";
import { introCue, stageCue } from "../fx/gpu/cues";
import { frameLoop } from "../fx/loop";
import { desktopIpc } from "../ipc/commands";
import { hubStore } from "../store";

/** The parts of the Battery Status API read here (absent from TypeScript's DOM types). */
interface Battery extends EventTarget {
  charging: boolean;
}

/**
 * « Auto » quality, main window only (step 24): while the saved quality is « Auto », every frame
 * the app's loop draws anyway feeds src/fx/autoQuality.ts; its rung goes to `autoQualityStore`
 * (the level drawn, the hover and the float follow it: userPrefs.ts). Another saved quality: the
 * watcher sleeps and « Auto » starts again from the top next time.
 */
export function installAutoQualityWatch(opts: { hz?: number } = {}): void {
  let auto = new AutoQuality();
  let onBattery = false;
  let last = -1;
  let stop: (() => void) | null = null;
  let hz: number | null = opts.hz ?? null;

  // The screen's refresh rate, asked again when the window may have changed screens.
  const askHz = () => {
    if (opts.hz) return; // given (the dev page, outside the app)
    void desktopIpc
      .refreshHz()
      .then((r) => {
        hz = r.ok ? r.value : null;
        auto.setScreenHz(hz);
      })
      .catch(() => undefined);
  };
  window.addEventListener("focus", askHz);
  window.addEventListener("resize", askHz);

  const publish = () => {
    const next = auto.state;
    const cur = autoQualityStore.getState().state;
    if (next.rung === cur.rung && next.reason === cur.reason && next.frozen === cur.frozen) return;
    autoQualityStore.setState({ state: next });
    console.info(
      `Qualité Auto : ${next.rung}${next.reason ? ` (${next.reason})` : ""}${next.frozen ? ", figée" : ""}`,
    );
  };

  const frame = (now: number) => {
    const interval = last < 0 ? 0 : now - last;
    last = now;
    const sequence = introCue() !== null || stageCue() !== null;
    if (auto.frame(interval, now, sequence)) publish();
  };

  const follow = (on: boolean) => {
    if (on === (stop !== null)) return;
    if (on) {
      auto = new AutoQuality();
      auto.setBattery(onBattery);
      auto.setScreenHz(hz);
      askHz();
      last = -1;
      stop = frameLoop().observe?.(frame) ?? null;
    } else {
      stop?.();
      stop = null;
      auto = new AutoQuality();
    }
    publish();
  };

  follow(hubStore.getState().settings?.quality === "auto");
  hubStore.subscribe((s, prev) => {
    if (s.settings?.quality !== prev.settings?.quality) follow(s.settings?.quality === "auto");
  });

  // On battery, Équilibré at most (where the browser tells; nothing otherwise).
  const nav = navigator as Navigator & { getBattery?: () => Promise<Battery> };
  void nav
    .getBattery?.()
    .then((b) => {
      const check = () => {
        onBattery = !b.charging;
        if (stop && auto.setBattery(onBattery)) publish();
      };
      check();
      b.addEventListener("chargingchange", check);
    })
    .catch(() => undefined);
}
