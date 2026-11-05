import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CheckIcon, ChevronDownIcon } from "../../design";
import { t, type MessageKey } from "../../i18n";
import type { VoiceMicrophone } from "../../ipc/bindings";
import { voiceIpc, type Outcome } from "../../ipc/commands";
import own from "./Voice.module.css";

interface Props {
  /** The chosen device's Windows id (empty: Windows' default one). */
  value: string;
  onChange: (id: string) => void;
}

interface DeviceProps extends Props {
  /** The devices Windows has (asked once, when the picker shows). */
  load: () => Promise<Outcome<VoiceMicrophone[]>>;
  /** The i18n keys: `<keys>.label`, `.default` (Windows' own), `.gone` (the chosen one is away). */
  keys: string;
}

/**
 * A drop-down of audio devices, inside Réglages (a menu in a portal would sit under the dialog's
 * `inert`). Arrows move, Entrée / Espace pick, Échap closes.
 */
function DevicePicker({ value, onChange, load, keys }: DeviceProps) {
  const [devices, setDevices] = useState<VoiceMicrophone[]>([]);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useId();
  const text = (part: string) => t(`${keys}.${part}` as MessageKey);

  useEffect(() => {
    void load().then((r) => r.ok && setDevices(r.value));
  }, [load]);

  const choices = [{ id: "", name: text("default") }, ...devices];
  const current = choices.find((c) => c.id === value) ?? { id: value, name: text("gone") };

  function show() {
    setAt(
      Math.max(
        0,
        choices.findIndex((c) => c.id === value),
      ),
    );
    setOpen(true);
  }

  function pick(id: string) {
    setOpen(false);
    button.current?.focus();
    if (id !== value) onChange(id);
  }

  function onKey(e: KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        show();
      }
      return;
    }
    const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    if (e.key in step) {
      e.preventDefault();
      setAt((i) => (i + (step[e.key] ?? 0) + choices.length) % choices.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(choices[at]?.id ?? "");
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className={own.picker}>
      <button
        ref={button}
        type="button"
        className={own.pickerButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={list}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        onBlur={() => setOpen(false)}
      >
        <span className={own.pickerName}>{current.name}</span>
        <ChevronDownIcon size={14} />
      </button>
      {open && (
        <ul className={own.pickerList} id={list} role="listbox" aria-label={text("label")}>
          {choices.map((c, i) => (
            <li
              key={c.id || "default"}
              role="option"
              aria-selected={c.id === value}
              data-at={i === at || undefined}
              className={own.pickerItem}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c.id);
              }}
              onMouseEnter={() => setAt(i)}
            >
              <span className={own.pickerName}>{c.name}</span>
              {c.id === value && <CheckIcon size={14} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** « Micro » (step 21): the microphones Windows has. */
export function MicPicker(props: Props) {
  return <DevicePicker {...props} load={voiceIpc.microphones} keys="settings.voice.mic" />;
}

/** « Enceintes à écouter »: the output whose sound the echo canceller takes out. */
export function OutputPicker(props: Props) {
  return <DevicePicker {...props} load={voiceIpc.outputs} keys="settings.voice.output" />;
}
