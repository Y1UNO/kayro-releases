import { useMemo, useReducer, useRef, useState } from "react";
import {
  Button,
  ChevronLeftIcon,
  PlayIcon,
  SegmentedControl,
  StopIcon,
  Surface,
} from "../../design";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { hubStore, sceneStore, useDesktop, useHub, useScenes } from "../../store";
import { AdvancedEditor } from "./AdvancedEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  draftFromScene,
  isSaveable,
  newDraft,
  reduce,
  resolved,
  snapshot,
  toScene,
  trySimple,
  type EditorMode,
} from "./draft";
import { HotkeyField } from "./HotkeyField";
import { slotLabel, slotsOf } from "./model";
import { SimpleEditor } from "./SimpleEditor";
import { usePlayScene } from "./usePlayScene";
import { Notice } from "../home/Overlays";
import styles from "./Editor.module.css";

interface Props {
  /** null = a new scene. */
  sceneId: string | null;
  onBack: () => void;
}

type Ask = null | { kind: "leave" } | { kind: "slot"; slot: string; steps: number };

/** Editor of one scene, in simple mode (drop apps) or advanced mode (the steps themselves). */
export function SceneEditor({ sceneId, onBack }: Props) {
  const apps = useHub((s) => s.apps);
  const settingsHotkey = useHub((s) => s.settings?.hotkey);
  const scenes = useScenes((s) => s.scenes);
  const run = useScenes((s) => s.run);
  const registrations = useDesktop((s) => s.hotkeys?.scenes);
  const { request, dialog } = usePlayScene();

  const [draft, dispatch] = useReducer(reduce, undefined, () => {
    const { scenes: all, slots } = sceneStore.getState();
    const scene = sceneId ? all.find((s) => s.id === sceneId) : undefined;
    return scene ? draftFromScene(scene, slots, hubStore.getState().apps) : newDraft({ ...slots });
  });
  const [savedId, setSavedId] = useState<string | null>(draft.id);
  // The saved shortcut of this scene is refused by Windows (another program owns it).
  const unregistered =
    draft.hotkey !== null &&
    registrations?.some(
      (r) => r.sceneId === savedId && r.hotkey === draft.hotkey && r.problem === "conflict",
    ) === true;
  const baseline = useRef(snapshot(draft, apps));
  const [ask, setAsk] = useState<Ask>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = snapshot(draft, apps) !== baseline.current;
  const saveable = isSaveable(draft, apps);
  const playing = run !== null && run.status === null;
  // Marks describe the steps as they were when the run started: hidden once the steps change.
  const mine = run !== null && run.sceneId === savedId && !dirty ? run : null;

  const otherSlots = useMemo(() => {
    const used = new Set<string>();
    for (const s of scenes) if (s.id !== savedId) slotsOf(s.steps).forEach((x) => used.add(x));
    return used;
  }, [scenes, savedId]);

  async function save(): Promise<string | null> {
    if (!saveable) return null;
    setProblem(null);
    const id = savedId ?? (await sceneStore.getState().newId(draft.name));
    const { links } = resolved(draft, apps);
    const r = await sceneStore.getState().save(toScene(draft, apps, id), links);
    if (!r.ok) {
      setProblem(errorText(r.error));
      return null;
    }
    setSavedId(id);
    baseline.current = snapshot(draft, apps);
    setNotice(t("scenes.editor.saved"));
    window.setTimeout(() => setNotice(null), 3000);
    return id;
  }

  async function test() {
    const id = await save();
    const scene = id ? sceneStore.getState().scenes.find((s) => s.id === id) : undefined;
    if (scene) request(scene);
  }

  function setMode(mode: EditorMode) {
    if (mode === draft.mode) return;
    setProblem(null);
    if (mode === "advanced") return dispatch({ type: "toAdvanced", apps });
    const back = trySimple(draft, apps);
    if (back) dispatch({ type: "toSimple", simple: back.simple });
    else setProblem(t("scenes.editor.notSimple"));
  }

  function askDeleteSlot(slot: string) {
    const steps = draft.steps.filter((s) => "slot" in s.step && s.step.slot === slot).length;
    if (steps === 0) deleteSlot(slot);
    else setAsk({ kind: "slot", slot, steps });
  }

  function deleteSlot(slot: string) {
    dispatch({ type: "deleteSlot", slot, keepLink: otherSlots.has(slot) });
    setAsk(null);
  }

  function leave() {
    if (dirty) setAsk({ kind: "leave" });
    else onBack();
  }

  return (
    <main className={styles.screen}>
      <Surface as="header" radius="32px" className={styles.bar}>
        <Button size="sm" onClick={leave}>
          <ChevronLeftIcon size={16} />
          {t("scenes.back")}
        </Button>
        <input
          className={styles.name}
          value={draft.name}
          maxLength={80}
          placeholder={t("scenes.editor.namePlaceholder")}
          aria-label={t("scenes.editor.name")}
          onChange={(e) => dispatch({ type: "name", name: e.target.value })}
        />
        <HotkeyField
          value={draft.hotkey}
          unregistered={unregistered}
          taken={[...scenes.filter((s) => s.id !== savedId).map((s) => s.hotkey), settingsHotkey]}
          onChange={(hotkey) => dispatch({ type: "hotkey", hotkey })}
        />
        <div className={styles.spacer} />
        <SegmentedControl<EditorMode>
          label={t("scenes.editor.mode")}
          size="sm"
          value={draft.mode}
          onChange={setMode}
          options={[
            { value: "simple", label: t("scenes.editor.simple") },
            { value: "advanced", label: t("scenes.editor.advanced") },
          ]}
        />
        {playing ? (
          <Button onClick={() => void sceneStore.getState().cancel()}>
            <StopIcon />
            {t("scenes.editor.cancel")}
          </Button>
        ) : (
          <Button disabled={!saveable} onClick={() => void test()}>
            <PlayIcon />
            {t("scenes.editor.test")}
          </Button>
        )}
        <Button variant="primary" disabled={!saveable || !dirty} onClick={() => void save()}>
          {t("scenes.editor.save")}
        </Button>
      </Surface>

      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}
      {draft.mode === "simple" ? (
        <SimpleEditor draft={draft} apps={apps} dispatch={dispatch} run={mine?.steps} />
      ) : (
        <AdvancedEditor
          draft={draft}
          apps={apps}
          dispatch={dispatch}
          run={mine?.steps}
          onDeleteSlot={askDeleteSlot}
        />
      )}
      <p className={styles.testNote}>{t("scenes.editor.testNote")}</p>

      <ConfirmDialog
        open={ask?.kind === "leave"}
        title={t("scenes.leave.title")}
        confirmLabel={t("scenes.leave.discard")}
        cancelLabel={t("scenes.leave.keep")}
        extra={
          saveable
            ? {
                label: t("scenes.leave.save"),
                onClick: () => {
                  void save().then((id) => id && onBack());
                },
              }
            : undefined
        }
        onCancel={() => setAsk(null)}
        onConfirm={onBack}
      >
        <p>{t("scenes.leave.text")}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={ask?.kind === "slot"}
        title={t("scenes.slots.deleteTitle", {
          slot: slotLabel(ask?.kind === "slot" ? ask.slot : ""),
        })}
        confirmLabel={t("scenes.slots.deleteYes")}
        cancelLabel={t("scenes.slots.deleteNo")}
        onCancel={() => setAsk(null)}
        onConfirm={() => ask?.kind === "slot" && deleteSlot(ask.slot)}
      >
        <p>{t("scenes.slots.deleteText", { count: ask?.kind === "slot" ? ask.steps : 0 })}</p>
      </ConfirmDialog>
      {dialog}
      {notice && <Notice text={notice} />}
    </main>
  );
}
