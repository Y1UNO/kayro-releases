import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { announceReady } from "../../app/useWindowShown";
import { isEco } from "../../design/quality";
import { useReducedMotion } from "../../fx/useReducedMotion";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { desktopIpc, mediaIpc } from "../../ipc/commands";
import { playSound } from "../../sound";
import { hubStore, sceneStore, useHub, useScenes } from "../../store";
import { usePassage } from "../modes/usePassage";
import { useUpdate } from "../update/updateStore";
import { closeTargets } from "../scenes/model";
import { runningApps, searchPanel, type WidgetHit } from "../widget/widgetModel";
import { IslandPanel } from "./IslandPanel";
import { IslandRest } from "./IslandRest";
import { islandRoom, roomPlan, SHRINK_AFTER_MS, type Room } from "./clickRegion";
import { DOCKED } from "./islandShape";
import { DEFAULT_DELAY_MS } from "./islandTuck";
import { rgbOf, trackKey } from "./music";
import { panelSize } from "./panelSize";
import { useMusicStage } from "./stage/useMusicStage";
import { useIsland } from "./useIsland";
import { useBeat, useLaunchStretch, useNowPlaying } from "./useIslandData";
import styles from "./Island.module.css";

/** Search results shown in the opened island. */
const HITS = 3;

/** « Passer en immersif »: Kayro comes in immersive mode (the island goes by itself). */
async function openImmersive(): Promise<void> {
  const { settings, setSettings } = hubStore.getState();
  if (settings && settings.displayMode !== "immersive")
    await setSettings({ displayMode: "immersive" });
  await desktopIpc.show();
}

/**
 * Step 20 (Kysland): the widget window's page, the island. At rest it shows the music playing
 * (a small turning record, bars on the beat), stretches when an app starts, and on hover shows
 * the running apps; opened, a search (apps and scenes that close nothing), the music with its
 * controls, the running apps and the way to the immersive mode. A transparent stage the size of
 * the window: the effects' canvas, and above it the island in a layer cut to its screen.
 */
export function IslandApp() {
  const quality = useHub((s) => s.settings?.quality);
  const passage = useHub((s) => s.settings?.islandPassage) ?? "force";
  const apps = useHub((s) => s.apps);
  const running = useHub((s) => s.running);
  const scenes = useScenes((s) => s.scenes);
  const slots = useScenes((s) => s.slots);
  const calm = useReducedMotion();
  const island = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const np = useNowPlaying();
  const { stretch: launching, announce, say } = useLaunchStretch();
  // « Cacher l'île »: its place on the top edge is as wide as the island at rest (`sentRoom`).
  const tuckOn = useHub((s) => Boolean(s.settings?.islandAlways && s.settings.islandTuck));
  const tuckDelay = useHub((s) => s.settings?.islandTuckDelay);
  const sentRoom = useRef<Room | null>(null);
  // « Mode musique »: while music plays, the island dances in the middle of its screen.
  const musicOn = useHub((s) => Boolean(s.settings?.islandMusic));
  const musicMode = useHub((s) => s.settings?.islandMusicMode ?? "disk");
  const [staged, setStaged] = useState(false);
  const controls = useIsland(
    { island, layer, canvas },
    { calm, effects: !isEco(quality), passage },
    {
      enabled: tuckOn,
      delayMs: tuckDelay != null ? tuckDelay * 1000 : DEFAULT_DELAY_MS,
      // Music mode wanted (or on): the island stays out of the top edge.
      stretched: launching !== null || staged || (musicOn && Boolean(np?.playing)),
      width: () => sentRoom.current?.[0] ?? DOCKED.width,
    },
  );
  // Step 20: an update found at start is said on the island (it installs from Kayro's window).
  const update = useUpdate((s) => s.announced);
  useEffect(() => {
    if (update) say(t("island.update", { version: update.version }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);
  const stageCanvas = useRef<HTMLCanvasElement>(null);
  const stage = useMusicStage(
    {
      on: musicOn,
      np,
      open: controls.open,
      tucked: controls.tucked,
      calm,
      effects: !isEco(quality),
      mode: musicMode,
    },
    stageCanvas,
    island,
  );
  const inStage = stage.phase !== "off";
  if (inStage !== staged) setStaged(inStage);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  // Leaving or entering the widget mode fades the page out or in (round 4b).
  usePassage("widget");
  useBeat(island, Boolean(np?.playing) && !controls.open && !controls.tucked);

  const live = useMemo(() => runningApps(apps, running), [apps, running]);
  // Only the scenes that close nothing: the island has no room to ask for a confirmation.
  const safe = useMemo(
    () => scenes.filter((s) => closeTargets(s.steps, slots, apps).length === 0),
    [scenes, slots, apps],
  );
  const hits = useMemo(() => searchPanel(query, apps, safe, HITS), [query, apps, safe]);

  useEffect(() => {
    void (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await announceReady();
    })();
  }, []);

  // What it shows at rest.
  const shown = { media: np !== null, stretch: launching !== null, dots: live.length > 0 };
  const { activity } = controls;
  const playing = Boolean(np?.playing);
  useEffect(() => {
    activity({ ...shown, playing });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.media, shown.stretch, shown.dots, playing, activity]);

  // The room it takes at rest, for the core's click region: it grows at once, shrinks once the
  // island has (no cut while it shrinks). Sent on a change only, no loop.
  const [hovered, setHovered] = useState(false);
  const room = islandRoom({
    ...shown,
    hover: hovered,
    breath: Boolean(np?.playing),
    idle: controls.idling,
  });
  useEffect(() => {
    const send = (r: Room) => {
      sentRoom.current = r;
      void desktopIpc.islandFootprint(r);
    };
    const { now, later } = roomPlan(sentRoom.current, room);
    if (now) send(now);
    if (!later) return;
    const id = window.setTimeout(() => send(later), SHRINK_AFTER_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room[0], room[1], room[2], room[3]]);

  // Opened, it is as big as what it shows; the click region grows at once, shrinks once the
  // island has (no cut while it shrinks).
  const searching = query.trim() !== "";
  const size = panelSize({ searching, hits: hits.length, music: np !== null });
  const { panelSize: resize } = controls;
  const sent = useRef({ width: 0, height: 0 });
  useEffect(() => {
    resize(size.width, size.height);
    const send = () => {
      sent.current = size;
      void desktopIpc.islandPanel(size.width, size.height);
    };
    const grows = size.width > sent.current.width || size.height > sent.current.height;
    if (grows) return send();
    const id = window.setTimeout(send, 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // The album's colours: the record's ring, the bars, the halo.
  const colors = np?.colors;
  useEffect(() => {
    const el = island.current;
    if (!el) return;
    const set = (name: string, hex: string | undefined) => {
      const rgb = rgbOf(hex);
      if (rgb) el.style.setProperty(name, rgb);
      else el.style.removeProperty(name);
    };
    set("--album-d", colors?.[0]);
    set("--album-a", colors?.[1]);
  }, [colors]);

  // Another track: a small jolt (a glitch in « Glitch »).
  const key = trackKey(np);
  const lastKey = useRef(key);
  const { trackChanged } = controls;
  useEffect(() => {
    if (lastKey.current && key && key !== lastKey.current) trackChanged();
    lastKey.current = key;
  }, [key, trackChanged]);

  // Opened, it closes when another program takes the focus; closed, its search is forgotten.
  const { close, open } = controls;
  useEffect(() => {
    window.addEventListener("blur", close);
    return () => window.removeEventListener("blur", close);
  }, [close]);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setQuery("");
      setSelected(0);
    }
  }

  const front = (app: AppEntry) => void hubStore.getState().focusApp(app.id);
  const launch = (hit: WidgetHit) => {
    if (hit.kind === "app") {
      playSound("launch");
      announce(hit.app);
      void hubStore.getState().launchApp(hit.app.id);
    } else {
      void sceneStore.getState().play(hit.scene.id, false);
    }
    close();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || controls.open) return;
    // A dot brings its app to the front: no gesture.
    if (e.target instanceof Element && e.target.closest("[data-dot]")) return;
    e.preventDefault();
    controls.press();
  };

  return (
    <div className={styles.stage} data-music={inStage ? stage.phase : undefined}>
      <canvas ref={canvas} className={styles.bubbles} aria-hidden />
      <canvas
        ref={stageCanvas}
        className={styles.music}
        role="img"
        aria-label={t("island.music.stageLeave")}
        onPointerDown={(e) => {
          if (e.button === 0 && stage.click(e.clientX, e.clientY)) e.preventDefault();
        }}
      />
      <div ref={layer} className={styles.layer}>
        <div
          ref={island}
          className={styles.island}
          data-open={controls.open || undefined}
          data-stage={inStage || undefined}
          role={controls.open ? "dialog" : "img"}
          aria-label={t(controls.open ? "island.openLabel" : "island.label")}
          onPointerDown={onPointerDown}
          onPointerEnter={() => {
            setHovered(true);
            controls.hover(true);
          }}
          onPointerLeave={() => {
            setHovered(false);
            controls.hover(false, query !== "");
          }}
        >
          <span className={styles.shoulder} data-at="top-left" />
          <span className={styles.shoulder} data-at="top-right" />
          <span className={styles.shoulder} data-at="side-left" />
          <span className={styles.shoulder} data-at="side-right" />
          <span className={styles.glint} aria-hidden="true" />
          <IslandRest np={np} launch={launching} running={live} onFront={front} />
          <IslandPanel
            open={controls.open}
            query={query}
            hits={hits}
            selected={Math.min(selected, Math.max(0, hits.length - 1))}
            np={np}
            onQuery={(q) => {
              setQuery(q);
              setSelected(0);
            }}
            onSelect={setSelected}
            onLaunch={launch}
            onMedia={(action) => void mediaIpc.control(action)}
            onImmersive={() => void openImmersive()}
            onClose={close}
            stage={musicOn}
            onStage={(on) => {
              void hubStore.getState().setSettings({ islandMusic: on });
              if (on && np?.playing) close();
            }}
            stageMode={musicMode}
            onStageMode={(mode) => void hubStore.getState().setSettings({ islandMusicMode: mode })}
          />
        </div>
      </div>
    </div>
  );
}
