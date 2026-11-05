import { useEffect, useState } from "react";
import { Button } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { HandsSettings } from "../../ipc/bindings";
import { handsIpc } from "../../ipc/commands";
import { hubStore, useDesktop, useHub } from "../../store";
import { HandTutorial } from "../hands/HandTutorial";
import { refreshHandsModel, useHands } from "../hands/handsStore";
import { HotkeyField } from "../scenes/HotkeyField";
import { HandsInstall } from "./HandsInstall";
import { ChoiceRow, ToggleRow } from "./SettingRow";
import { Block } from "./VoiceBlock";
import own from "./Voice.module.css";
import css from "./Assistant.module.css";

const SIGNS = ["free", "left", "right", "rest", "screens", "off"] as const;
const IDLE = ["1", "2", "5", "10"] as const;
const RIGHT = ["ring", "middle"] as const;
const REACH = [
  ["0.7", "reachSmall"],
  ["1", "reachMid"],
  ["1.5", "reachLarge"],
] as const;

/** The reach shown: the closest of the three choices. */
function reachChoice(reach: number): (typeof REACH)[number][0] {
  return reach < 0.85 ? "0.7" : reach > 1.25 ? "1.5" : "1";
}

/**
 * Réglages › Mains (step 22): a mouse in the air. The first time, the introduction, the two signs
 * and one « Installer »; once installed, the hand that shows the signs and the right click's
 * finger (ring or middle, the user's choice); then a card (where the camera stands, a button to
 * turn it on or off, its shortcut), the signs, and the rest folded under « Modifier les réglages ».
 */
export function HandsSection() {
  const settings = useHub((s) => s.settings);
  const hotkeys = useDesktop((s) => s.hotkeys);
  const model = useHands((s) => s.model);
  const state = useHands((s) => s.state);
  const [editing, setEditing] = useState(false);
  // The signs shown by the hand: right after the install, or « Revoir les gestes ».
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    void refreshHandsModel();
  }, []);
  const hands = settings?.hands;
  if (!settings || !hands) return null;
  const set = (patch: Partial<HandsSettings>) =>
    hubStore.getState().setSettings({ hands: { ...hands, ...patch } });
  const installed = model?.installed ?? false;
  const right = hands.rightFinger ?? "ring";
  const installedNow = () => {
    void set({ enabled: true });
    setIntro(true);
  };
  const rightChoice = (
    <ChoiceRow
      label={t("hands.gesture.choice")}
      help={t("hands.gesture.choiceHelp")}
      value={right}
      options={RIGHT.map((f) => ({ value: f, label: t(`hands.gesture.${f}` as MessageKey) }))}
      onChange={(v) => void set({ rightFinger: v as (typeof RIGHT)[number] })}
    />
  );

  async function turn(on: boolean) {
    if (on && !hands?.enabled) await set({ enabled: true });
    await handsIpc.setOn(on);
  }

  const signs = (
    <Block eyebrow={t("hands.help.eyebrow")} title={t("hands.help.title")}>
      <ul className={css.says}>
        {SIGNS.map((sign) => {
          const key = sign === "right" && right === "middle" ? "rightMiddle" : sign;
          return <li key={sign}>{t(`hands.help.${key}` as MessageKey)}</li>;
        })}
      </ul>
      <p className={own.intro}>{t("hands.help.tip")}</p>
      {installed && !intro && (
        <button type="button" className={css.fold} onClick={() => setIntro(true)}>
          {t("hands.gesture.replay")}
        </button>
      )}
    </Block>
  );
  const footer = (
    <>
      <p className={own.privacy}>{t("hands.privacy")}</p>
      <p className={own.privacy}>{t("hands.limit")}</p>
      <p className={own.privacy}>{t("hands.credits")}</p>
    </>
  );

  if (!installed) {
    return (
      <div className={own.capri} data-cascade="">
        <p className={own.intro}>{t("hands.intro")}</p>
        <Block eyebrow={t("hands.card.eyebrow")} title={t("hands.card.title")}>
          <HandsInstall onInstalled={installedNow} onRemoved={() => void set({ enabled: false })} />
        </Block>
        {signs}
        {footer}
      </div>
    );
  }

  const taken = [
    settings.hotkey,
    settings.searchHotkey,
    settings.voice.hotkey,
    ...(hotkeys?.scenes ?? []).map((s) => s.hotkey),
  ];
  const shown = intro && (
    <Block eyebrow={t("hands.gesture.eyebrow")} title={t("hands.gesture.title")}>
      <HandTutorial right={right} />
      {rightChoice}
      <div className={own.line}>
        {!state.on && (
          <Button
            variant="primary"
            onClick={() => {
              setIntro(false);
              void turn(true);
            }}
          >
            {t("hands.card.on")}
          </Button>
        )}
        <Button onClick={() => setIntro(false)}>{t("hands.gesture.close")}</Button>
      </div>
    </Block>
  );
  return (
    <div className={own.capri} data-cascade="">
      {shown}
      <Block eyebrow={t("hands.card.eyebrow")} title={t("hands.card.title")}>
        <p className={own.status} data-status={state.on ? "hearing" : undefined} role="status">
          {t(`hands.status.${state.status}` as MessageKey)}
        </p>
        <div className={own.line}>
          <Button variant={state.on ? undefined : "primary"} onClick={() => void turn(!state.on)}>
            {t(state.on ? "hands.card.off" : "hands.card.on")}
          </Button>
        </div>
        {hands.enabled && hands.hotkey && (
          <p className={own.intro}>{t("hands.card.shortcut", { key: hands.hotkey })}</p>
        )}
      </Block>
      {signs}
      <button
        type="button"
        className={css.fold}
        aria-expanded={editing}
        onClick={() => setEditing(!editing)}
      >
        {t(editing ? "hands.settings.hide" : "hands.settings.show")}
      </button>
      {editing && (
        <Block eyebrow={t("hands.settings.eyebrow")} title={t("hands.settings.title")}>
          <ToggleRow
            label={t("hands.settings.enabled")}
            help={t("hands.settings.enabledHelp")}
            checked={hands.enabled}
            onChange={(enabled) => void set({ enabled })}
          />
          <div className={own.line}>
            <span className={own.lineLabel}>{t("hands.settings.hotkey")}</span>
            <HotkeyField
              value={hands.hotkey || null}
              taken={taken}
              unregistered={hotkeys?.hands?.problem != null}
              onChange={(k) => void set({ hotkey: k ?? "" })}
            />
          </div>
          {rightChoice}
          <ChoiceRow
            label={t("hands.settings.reach")}
            help={t("hands.settings.reachHelp")}
            value={reachChoice(hands.reach ?? 1)}
            options={REACH.map(([value, key]) => ({
              value,
              label: t(`hands.settings.${key}` as MessageKey),
            }))}
            onChange={(v) => void set({ reach: Number(v) })}
          />
          <ChoiceRow
            label={t("hands.settings.idle")}
            help={t("hands.settings.idleHelp")}
            value={
              (IDLE as readonly string[]).includes(String(hands.idleMinutes))
                ? String(hands.idleMinutes)
                : "2"
            }
            options={IDLE.map((n) => ({ value: n, label: t("hands.settings.minutes", { n }) }))}
            onChange={(v) => void set({ idleMinutes: Number(v) })}
          />
          <ToggleRow
            label={t("hands.settings.glow")}
            help={t("hands.settings.glowHelp")}
            checked={hands.glow}
            onChange={(glow) => void set({ glow })}
          />
          <ToggleRow
            label={t("hands.settings.inGame")}
            help={t("hands.settings.inGameHelp")}
            checked={hands.inGame}
            onChange={(inGame) => void set({ inGame })}
          />
          <HandsInstall onInstalled={installedNow} onRemoved={() => void set({ enabled: false })} />
        </Block>
      )}
      {footer}
    </div>
  );
}
