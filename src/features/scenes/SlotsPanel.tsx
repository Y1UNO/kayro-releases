import { useState } from "react";
import type { FormEvent } from "react";
import { Button, IconButton, Surface, TrashIcon } from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { slotLabel, slugifySlot } from "./model";
import styles from "./Side.module.css";

interface Props {
  slots: readonly string[];
  links: Readonly<Record<string, string>>;
  apps: readonly AppEntry[];
  onLink: (slot: string, appId: string | null) => void;
  onAdd: (slot: string) => void;
  onDelete: (slot: string) => void;
}

/** « Emplacements de la scène »: each slot is a name, linked here to one of the user's apps. */
export function SlotsPanel({ slots, links, apps, onLink, onAdd, onDelete }: Props) {
  const [text, setText] = useState("");
  const slug = slugifySlot(text);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (slug === "") return;
    onAdd(slug);
    setText("");
  }

  return (
    <Surface radius="var(--radius-2xl)" className={styles.side}>
      <h2 className={styles.label}>{t("scenes.slots.title")}</h2>
      {slots.length === 0 && <p className={styles.muted}>{t("scenes.slots.empty")}</p>}
      <ul className={styles.slotList}>
        {slots.map((slot) => {
          const linked = links[slot] ?? "";
          const known = apps.some((a) => a.id === linked);
          return (
            <li key={slot} className={styles.slot} data-warn={!known || undefined}>
              <span className={styles.slotName}>{slotLabel(slot)}</span>
              <select
                className={styles.select}
                aria-label={t("scenes.slots.linkLabel", { slot: slotLabel(slot) })}
                value={known ? linked : ""}
                onChange={(e) => onLink(slot, e.target.value || null)}
              >
                <option value="">{t("scenes.slots.unlinked")}</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <IconButton
                label={t("scenes.slots.delete", { slot: slotLabel(slot) })}
                size="sm"
                onClick={() => onDelete(slot)}
              >
                <TrashIcon size={16} />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <form className={styles.addSlot} onSubmit={submit}>
        <input
          className={styles.select}
          value={text}
          maxLength={60}
          placeholder={t("scenes.slots.newPlaceholder")}
          aria-label={t("scenes.slots.newLabel")}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={slug === "" || slots.includes(slug)}>
          {t("scenes.slots.add")}
        </Button>
      </form>
      <p className={styles.muted}>{t("scenes.slots.note")}</p>
    </Surface>
  );
}
