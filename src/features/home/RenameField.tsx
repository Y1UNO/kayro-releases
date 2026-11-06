import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { createStore, useStore } from "zustand";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { hubStore } from "../../store";
import styles from "./RenameField.module.css";

/** Step 19c: the app whose name is being changed on its card (one at a time). */
const renaming = createStore<{ id: string | null }>(() => ({ id: null }));

export function startRename(id: string): void {
  renaming.setState({ id });
}

export function useRenaming(id: string): boolean {
  return useStore(renaming, (s) => s.id === id);
}

/** Longest name (the core's `MAX_NAME`). */
const MAX = 80;

/**
 * The name of an app changed right on its card: a field laid exactly over the name plate (the
 * card is a button, a field inside it would take its clicks). Entrée or leaving keeps the new
 * name, Échap goes back. Only the name shown in Kayro changes, never the program or shortcut.
 */
export function RenameField({ app, plate }: { app: AppEntry; plate: RefObject<HTMLElement | null> }) {
  const [value, setValue] = useState(app.name);
  // Measured once: the carousel does not move while the field is open.
  const [box] = useState<DOMRect | null>(() => plate.current?.getBoundingClientRect() ?? null);
  const field = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useLayoutEffect(() => {
    field.current?.focus();
    field.current?.select();
    const end = () => finish(false);
    window.addEventListener("resize", end);
    return () => window.removeEventListener("resize", end);
    // Once, when the field opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(keep: boolean) {
    if (done.current) return;
    done.current = true;
    const name = value.trim();
    if (keep && name && name !== app.name) {
      void hubStore.getState().updateApp({ ...app, name: name.slice(0, MAX) });
    }
    renaming.setState({ id: null });
  }

  if (!box) return null;
  return createPortal(
    <input
      ref={field}
      className={styles.field}
      style={{ left: box.left, top: box.top, width: Math.max(box.width, 160), height: box.height }}
      value={value}
      maxLength={MAX}
      aria-label={t("home.menu.renameField", { name: app.name })}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        else if (e.key === "Escape") finish(false);
      }}
    />,
    document.body,
  );
}
