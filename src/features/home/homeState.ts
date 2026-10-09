import { CATEGORY_IDS, type CategoryId } from "./categories";
import { clampIndex } from "./carouselGeometry";

export type HomeView = "carousel" | "grid";

export interface HomeState {
  category: CategoryId;
  view: HomeView;
  /** Selected card of each category (kept when switching tabs). */
  focus: Record<CategoryId, number>;
}

export type HomeAction =
  | { type: "setCategory"; category: CategoryId }
  | { type: "stepCategory"; delta: 1 | -1 }
  | { type: "setFocus"; index: number; count: number }
  | { type: "moveFocus"; delta: number; count: number }
  | { type: "setView"; view: HomeView };

export function initialHomeState(category: CategoryId = "jeux"): HomeState {
  return {
    category,
    view: "carousel",
    focus: { jeux: 0, stream: 0, creativite: 0, logiciels: 0, autres: 0 },
  };
}

export function homeReducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case "setCategory":
      return action.category === state.category ? state : { ...state, category: action.category };
    case "stepCategory": {
      const i = CATEGORY_IDS.indexOf(state.category) + action.delta;
      const next = CATEGORY_IDS[Math.min(CATEGORY_IDS.length - 1, Math.max(0, i))];
      return next && next !== state.category ? { ...state, category: next } : state;
    }
    case "setFocus":
    case "moveFocus": {
      const target =
        action.type === "setFocus" ? action.index : state.focus[state.category] + action.delta;
      const index = clampIndex(target, action.count);
      if (index === state.focus[state.category]) return state;
      return { ...state, focus: { ...state.focus, [state.category]: index } };
    }
    case "setView":
      return action.view === state.view ? state : { ...state, view: action.view };
  }
}
