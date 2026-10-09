import { useCallback, useMemo, useState } from "react";
import type {
  AppSource,
  Candidate,
  DetectedApp,
  Launch,
  MatchRule,
  NewApp,
  SourceKind,
} from "../../ipc/bindings";
import { CATEGORY_IDS, categoryOf, type CategoryId } from "../home/categories";

/** Where a proposed app comes from: a detection source, or a file / link the user gave. */
export type Origin = SourceKind | "drop";

/** An app proposed to the user (detected, dropped or pasted), before it is added. */
export interface Item {
  /** Stable identity inside its list. */
  key: string;
  name: string;
  origin: Origin;
  source: AppSource;
  launch: Launch;
  match: MatchRule;
  /** The suggested category. */
  category: CategoryId;
  alreadyAdded: boolean;
}

export interface ItemEdits {
  name?: string;
  category?: CategoryId;
}

function categoryFrom(suggested: string): CategoryId {
  return CATEGORY_IDS.find((id) => id === suggested) ?? categoryOf({ category: suggested });
}

export function itemFromDetected(app: DetectedApp, origin: SourceKind): Item {
  return {
    key: app.id,
    name: app.name,
    origin,
    source: app.source,
    launch: app.launch,
    match: app.match,
    category: categoryFrom(app.suggestedCategory),
    alreadyAdded: app.alreadyAdded,
  };
}

export function itemFromCandidate(c: Candidate): Item {
  return {
    key: c.input,
    name: c.name,
    origin: "drop",
    source: { kind: "manual" },
    launch: c.launch,
    match: c.match,
    category: categoryFrom(c.suggestedCategory),
    alreadyAdded: c.alreadyAdded,
  };
}

/** What `apps_add_many` receives. Art stays empty: posters come with a later step. */
export function toNewApp(item: Item, edits: ItemEdits = {}): NewApp {
  return {
    name: (edits.name ?? item.name).trim(),
    category: edits.category ?? item.category,
    source: item.source,
    launch: item.launch,
    match: item.match,
    art: { poster: null, hero: null },
    moodId: null,
    favorite: false,
  };
}

export interface ItemList {
  items: readonly Item[];
  selected: ReadonlySet<string>;
  edits: Readonly<Record<string, ItemEdits>>;
  /** Selected and not already in the list: what "Ajouter" would send. */
  chosen: readonly Item[];
  replaceAll: (items: Item[]) => void;
  /** Adds new items (existing keys are left alone), selected unless already added. */
  append: (items: Item[]) => void;
  toggle: (key: string) => void;
  setMany: (keys: readonly string[], on: boolean) => void;
  setCategory: (key: string, category: CategoryId) => void;
  setName: (key: string, name: string) => void;
  /** After a successful add: shown as already added, no longer selected. */
  markAdded: (keys: readonly string[]) => void;
}

/** Selection and per-item edits (name, category) of a list of proposed apps. */
export function useItemList(): ItemList {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, ItemEdits>>({});

  const replaceAll = useCallback((next: Item[]) => {
    setItems(next);
    setSelected(new Set());
    setEdits({});
  }, []);

  const append = useCallback((added: Item[]) => {
    setItems((current) => {
      const known = new Set(current.map((i) => i.key));
      return [...current, ...added.filter((i) => !known.has(i.key))];
    });
    setSelected((current) => {
      const next = new Set(current);
      for (const item of added) if (!item.alreadyAdded) next.add(item.key);
      return next;
    });
  }, []);

  const toggle = useCallback((key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const setMany = useCallback((keys: readonly string[], on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  const patchEdit = useCallback((key: string, patch: ItemEdits) => {
    setEdits((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }, []);
  const setCategory = useCallback(
    (key: string, category: CategoryId) => patchEdit(key, { category }),
    [patchEdit],
  );
  const setName = useCallback((key: string, name: string) => patchEdit(key, { name }), [patchEdit]);

  const markAdded = useCallback((keys: readonly string[]) => {
    const done = new Set(keys);
    setItems((current) => current.map((i) => (done.has(i.key) ? { ...i, alreadyAdded: true } : i)));
    setSelected((current) => new Set([...current].filter((k) => !done.has(k))));
  }, []);

  const chosen = useMemo(
    () => items.filter((i) => selected.has(i.key) && !i.alreadyAdded),
    [items, selected],
  );

  return {
    items,
    selected,
    edits,
    chosen,
    replaceAll,
    append,
    toggle,
    setMany,
    setCategory,
    setName,
    markAdded,
  };
}
