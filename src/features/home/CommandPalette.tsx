import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { EASE, SearchIcon, SPRING, Surface } from "../../design";
import { t } from "../../i18n";
import type { AppEntry } from "../../ipc/bindings";
import { monogram, shadeOf } from "./cardLook";
import { CATEGORY_LABELS, type CategoryId } from "./categories";
import { cssVars } from "./cssVars";
import { searchHome, type SearchResult } from "./search";
import styles from "./CommandPalette.module.css";

interface Props {
  open: boolean;
  apps: readonly AppEntry[];
  onClose: () => void;
  onPickApp: (app: AppEntry) => void;
  onPickCategory: (id: CategoryId) => void;
}

const labelOf = (id: CategoryId) => t(CATEGORY_LABELS[id]);

/** Ctrl+K palette: apps and categories, instant filter, Enter launches / opens. */
export function CommandPalette(props: Props) {
  return <AnimatePresence>{props.open && <Palette key="palette" {...props} />}</AnimatePresence>;
}

function Palette({ apps, onClose, onPickApp, onPickCategory }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const results = useMemo(() => searchHome(query, apps, labelOf), [query, apps]);
  const current = Math.min(active, Math.max(0, results.length - 1));

  // Modal behaviour: the app behind is inert, focus goes to the field and returns on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const appRoot = document.getElementById("root");
    appRoot?.setAttribute("inert", "");
    input.current?.focus();
    return () => {
      appRoot?.removeAttribute("inert");
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    list.current?.children[current]?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function choose(result: SearchResult | undefined) {
    if (!result) return;
    onClose();
    if (result.kind === "app") onPickApp(result.app);
    else onPickCategory(result.id);
  }

  function onKeyDown(e: KeyboardEvent) {
    const last = results.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive(current >= last ? 0 : current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive(current <= 0 ? Math.max(0, last) : current - 1);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(Math.max(0, last));
        break;
      case "Enter":
        e.preventDefault();
        choose(results[current]);
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "Tab":
        e.preventDefault(); // the field is the only control: focus stays in the palette
        break;
    }
  }

  return createPortal(
    <m.div
      className={styles.scrim}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE } }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <m.div
        className={styles.motion}
        initial={{ opacity: 0, y: -14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
        exit={{ opacity: 0, y: -8, transition: { duration: 0.15, ease: EASE } }}
      >
        <Surface
          as="section"
          radius="var(--radius-3xl)"
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label={t("home.palette.title")}
        >
          <div className={styles.field}>
            <SearchIcon size={18} />
            <input
              ref={input}
              className={styles.input}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results.length ? `${listId}-${current}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("home.palette.placeholder")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={t("home.palette.results")}
            className={styles.list}
          >
            {results.map((r, i) => (
              <li
                key={r.kind === "app" ? `a:${r.app.id}` : `c:${r.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                className={styles.row}
                onMouseMove={() => i !== current && setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // keep the focus in the field
                onClick={() => choose(r)}
              >
                <Row result={r} />
              </li>
            ))}
          </ul>
          {results.length === 0 && <p className={styles.empty}>{t("home.palette.noResults")}</p>}
          <p className={styles.hint}>{t("home.palette.hint")}</p>
        </Surface>
      </m.div>
    </m.div>,
    document.body,
  );
}

function Row({ result }: { result: SearchResult }) {
  if (result.kind === "category") {
    return (
      <>
        <span className={styles.tile} data-kind="category" aria-hidden="true">
          {"#"}
        </span>
        <span className={styles.name}>{labelOf(result.id)}</span>
        <span className={styles.kind}>{t("home.palette.kindCategory")}</span>
      </>
    );
  }
  return (
    <>
      <span
        className={styles.tile}
        aria-hidden="true"
        style={cssVars({ "--k": shadeOf(result.app.id) })}
      >
        {monogram(result.app.name)}
      </span>
      <span className={styles.name}>{result.app.name}</span>
      <span className={styles.kind}>{labelOf(result.category)}</span>
    </>
  );
}
