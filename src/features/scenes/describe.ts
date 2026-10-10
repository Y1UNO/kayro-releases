import type { AppEntry, Reason, Step } from "../../ipc/bindings";
import { t, type MessageKey } from "../../i18n";
import { isFollowed } from "./simple";
import { appOfSlot, secondsText, slotLabel, type StepKind } from "./model";

export interface Linking {
  apps: readonly AppEntry[];
  links: Readonly<Record<string, string>>;
}

export const KIND_LABELS: Record<StepKind, MessageKey> = {
  launch: "scenes.kind.launch",
  wait: "scenes.kind.wait",
  waitReady: "scenes.kind.waitReady",
  focus: "scenes.kind.focus",
  close: "scenes.kind.close",
};

export const REASON_LABELS: Record<Reason, MessageKey> = {
  slotUnlinked: "scenes.reason.slotUnlinked",
  notFollowable: "scenes.reason.notFollowable",
  notRunning: "scenes.reason.notRunning",
  timeout: "scenes.reason.timeout",
  confirmationRequired: "scenes.reason.confirmationRequired",
  cancelled: "scenes.reason.cancelled",
  aborted: "scenes.reason.aborted",
  launchNotFound: "scenes.reason.launchNotFound",
  launchDenied: "scenes.reason.launchDenied",
  elevationRequired: "scenes.reason.elevationRequired",
  elevationCancelled: "scenes.reason.elevationCancelled",
  launchFailed: "scenes.reason.launchFailed",
  focusFailed: "scenes.reason.focusFailed",
  closeFailed: "scenes.reason.closeFailed",
};

/** Name shown for a slot: the app it is linked to, else its own label. */
export function slotName(slot: string, link: Linking): string {
  return appOfSlot(slot, link.links, link.apps)?.name ?? slotLabel(slot);
}

const seconds = (ms: number) => secondsText(ms);

/** One readable sentence per step (« Lancer Discord », « Attendre 2 s »…). */
export function stepSentence(step: Step, link: Linking): string {
  switch (step.type) {
    case "launch":
      return t("scenes.line.launch", { name: slotName(step.slot, link) });
    case "wait":
      return t("scenes.line.wait", { seconds: seconds(step.ms) });
    case "waitReady":
      return t("scenes.line.waitReady", {
        name: slotName(step.slot, link),
        seconds: seconds(step.timeoutMs),
      });
    case "focus":
      return t("scenes.line.focus", { name: slotName(step.slot, link) });
    case "close":
      return t("scenes.line.close", { name: slotName(step.slot, link) });
  }
}

export interface RowText {
  title: string;
  sub: string;
  /** The step refers to a slot that is linked to nothing. */
  warn: boolean;
}

/** Title and sub-line of a step row of the advanced editor (reference/Editeur.dc.html). */
export function stepRowText(step: Step, link: Linking): RowText {
  if (step.type === "wait") {
    const s = step.ms / 1000;
    return {
      title: t(s <= 1 ? "scenes.row.secondOne" : "scenes.row.secondMany", {
        seconds: seconds(step.ms),
      }),
      sub: t("scenes.row.fixedDelay"),
      warn: false,
    };
  }
  const app = appOfSlot(step.slot, link.links, link.apps);
  const name = app?.name ?? slotLabel(step.slot);
  const linked = app ? t("scenes.row.linkedTo", { target: app.name }) : t("scenes.row.unlinked");
  switch (step.type) {
    case "launch":
      return { title: slotLabel(step.slot), sub: linked, warn: !app };
    case "waitReady":
      return {
        title: t("scenes.row.untilReady", { name }),
        sub: !app
          ? t("scenes.row.unlinked")
          : isFollowed(app)
            ? t("scenes.row.watching", { seconds: seconds(step.timeoutMs) })
            : t("scenes.row.cannotWatch"),
        warn: !app || !isFollowed(app),
      };
    case "focus":
      return { title: t("scenes.row.toFront", { name }), sub: linked, warn: !app };
    case "close":
      return {
        title: t("scenes.row.closeTitle", { name }),
        sub: t("scenes.row.closeSub"),
        warn: !app,
      };
  }
}
