import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { FlowState, FLOW_STORAGE_KEY, type FlowStateType } from "./states";
import { resolveTransition, type FlowEvent } from "./transitions";
import { STORAGE_KEYS } from "@/lib/storageKeys";

interface FlowContextValue {
  state: FlowStateType;
  payload: Record<string, unknown>;
  send: (event: FlowEvent, payload?: Record<string, unknown>) => FlowStateType | null;
  pending: boolean;
  setPending: (v: boolean) => void;
}

interface FlowReducerState {
  state: FlowStateType;
  payload: Record<string, unknown>;
}

type Action = { type: "TRANSITION"; next: FlowStateType; payload?: Record<string, unknown> };

function reducer(state: FlowReducerState, action: Action): FlowReducerState {
  if (action.type === "TRANSITION") {
    return {
      state: action.next,
      payload: { ...state.payload, ...(action.payload || {}) },
    };
  }
  return state;
}

function logTransition(from: FlowStateType, to: FlowStateType, event: FlowEvent) {
  const ts = new Date().toISOString();
  // Dev console; prod-analytics hook left as TODO.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info(`[FLOW] ${from} → ${to} via ${event} @ ${ts}`);
  }
  // TODO(prod): emit analytics event { from, to, event, ts }
}

function loadPersisted(): FlowReducerState | null {
  try {
    // Always clear onboarding state to prevent being stuck
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_DONE_SESSION);
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_STATE);

    const raw = localStorage.getItem(FLOW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlowReducerState;
    if (parsed?.state) {
      // Reset flow if stuck in mid-flow states, force fresh boot
      const staleStates = [FlowState.AUTH, FlowState.ONBOARDING];
      if (staleStates.includes(parsed.state)) {
        if (import.meta.env.DEV) console.log("[FLOW] Clearing stale state:", parsed.state);
        localStorage.removeItem(FLOW_STORAGE_KEY);
        return null;
      }
      if (import.meta.env.DEV) console.log("[FLOW] Loaded persisted state:", parsed.state);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const FlowContext = createContext<FlowContextValue | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    return loadPersisted() ?? { state: FlowState.APP_LAUNCH, payload: {} };
  });
  const pendingRef = useRef(false);
  // Force a re-render when pending toggles without making it part of reducer state.
  const [, force] = useReducer((x: number) => x + 1, 0);

  // Persist state across reloads.
  useEffect(() => {
    try {
      localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const send = useCallback(
    (event: FlowEvent, payload?: Record<string, unknown>) => {
      const next = resolveTransition(state.state, event);
      if (!next) return null;
      logTransition(state.state, next, event);
      dispatch({ type: "TRANSITION", next, payload });
      return next;
    },
    [state.state],
  );

  const setPending = useCallback((v: boolean) => {
    pendingRef.current = v;
    force();
  }, []);

  const value = useMemo<FlowContextValue>(
    () => ({
      state: state.state,
      payload: state.payload,
      send,
      pending: pendingRef.current,
      setPending,
    }),
    [state, send, setPending],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used within FlowProvider");
  return ctx;
}
