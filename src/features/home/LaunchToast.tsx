import { useMemo } from "react";
import type { AppEntry, ErrorCode } from "../../ipc/bindings";
import type { MessageKey } from "../../i18n";
import { t } from "../../i18n";
import { errorText } from "../../ipc/errors";
import { useHub } from "../../store";
import { Message } from "./Message";

/** Why a launch failed, in a few words after « {name} ne s'est pas lancé. » (round 4b). */
const LAUNCH_REASONS: Partial<Record<ErrorCode, MessageKey>> = {
  launchNotFound: "home.launchFail.launchNotFound",
  launchDenied: "home.launchFail.launchDenied",
  elevationRequired: "home.launchFail.elevationRequired",
  elevationCancelled: "home.launchFail.elevationCancelled",
  launchFailed: "home.launchFail.launchFailed",
};

/**
 * Shows the last refused operation (a launch that failed, a save that was rolled back). A launch
 * that failed names the app and offers « Corriger » (its card shakes once, see AppCard).
 */
export function LaunchToast({ onFix }: { onFix: (app: AppEntry) => void }) {
  const error = useHub((s) => s.lastError);
  const failedApp = useHub((s) => s.failedApp);
  const apps = useHub((s) => s.apps);
  const clear = useHub((s) => s.clearError);

  const content = useMemo(() => {
    if (!error) return null;
    // A dropped image the core refused as a poster (step 14, usePosterDrop).
    if (error.field === "artImage") return { id: error, text: t("home.artDrop.refused") };
    const app = failedApp ? apps.find((a) => a.id === failedApp) : undefined;
    const reason = LAUNCH_REASONS[error.code];
    if (!app || !reason) return { id: error, text: errorText(error) };
    return {
      id: error,
      text: `${t("home.launchFail.title", { name: app.name })} ${t(reason)}`,
      action:
        error.code === "elevationCancelled"
          ? undefined
          : {
              label: t("home.launchFail.fix"),
              run: () => {
                clear();
                onFix(app);
              },
            },
    };
    // `apps` changes do not make a new message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, failedApp]);

  return <Message content={content} onClose={clear} />;
}
