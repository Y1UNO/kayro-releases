import { useState } from "react";
import { Button } from "../../design";
import { t } from "../../i18n";
import type { AppError } from "../../ipc/bindings";
import { handsIpc } from "../../ipc/commands";
import { errorText } from "../../ipc/errors";
import { refreshHandsModel, useHands } from "../hands/handsStore";
import { size } from "./VoiceInstall";
import own from "./Voice.module.css";
import cards from "./VoiceModels.module.css";
import css from "./Assistant.module.css";

/**
 * « Installer les mains » (step 22): the two models behind one bar; once there, the room they take
 * and « Désinstaller les mains » (asked first). `onInstalled` turns the hands on (set up).
 */
export function HandsInstall({
  onInstalled,
  onRemoved,
}: {
  onInstalled: () => void;
  onRemoved: () => void;
}) {
  const model = useHands((s) => s.model);
  const progress = useHands((s) => s.progress);
  const [error, setError] = useState<AppError | null>(null);
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState(false);
  if (!model) return null;
  const total = size(model.sizeMb);

  async function install() {
    setError(null);
    const r = await handsIpc.download();
    await refreshHandsModel();
    if (r.ok) onInstalled();
    else if (r.error.code !== "downloadFailed" || !/cancelled/.test(r.error.message)) {
      setError(r.error);
    }
  }

  async function uninstall() {
    setRemoving(true);
    setError(null);
    onRemoved();
    const r = await handsIpc.remove();
    if (!r.ok) setError(r.error);
    await refreshHandsModel();
    setRemoving(false);
    setAsking(false);
  }

  const alert = error && (
    <p className={own.confirm} role="alert">
      {errorText(error)}
    </p>
  );

  if (model.downloading || progress) {
    const fraction = progress?.fraction ?? 0;
    return (
      <div className={cards.progress} role="status">
        <div className={cards.track}>
          <span className={cards.fill} style={{ transform: `scaleX(${fraction})` }} />
        </div>
        <div className={cards.progressLine}>
          <span>{t("hands.install.progress", { done: size(progress?.doneMb ?? 0), total })}</span>
          <Button size="sm" onClick={() => void handsIpc.cancel()}>
            {t("hands.install.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  if (model.installed) {
    return (
      <div className={css.install}>
        <p className={own.status}>{t("hands.install.size", { size: total })}</p>
        {asking ? (
          <>
            <p className={own.confirm}>{t("hands.install.removeAsk", { size: total })}</p>
            <div className={own.line}>
              <Button
                size="sm"
                variant="primary"
                disabled={removing}
                onClick={() => void uninstall()}
              >
                {t(removing ? "hands.install.removing" : "hands.install.removeYes")}
              </Button>
              <Button size="sm" disabled={removing} onClick={() => setAsking(false)}>
                {t("hands.install.keep")}
              </Button>
            </div>
          </>
        ) : (
          <div className={own.line}>
            <Button size="sm" onClick={() => setAsking(true)}>
              {t("hands.install.remove")}
            </Button>
          </div>
        )}
        {alert}
      </div>
    );
  }

  return (
    <div className={css.install}>
      <p className={own.intro}>{t("hands.install.missing", { size: total })}</p>
      <div className={own.line}>
        <Button variant="primary" onClick={() => void install()}>
          {t("hands.install.button", { size: total })}
        </Button>
      </div>
      <p className={own.intro}>{t("hands.install.network")}</p>
      {alert}
    </div>
  );
}
