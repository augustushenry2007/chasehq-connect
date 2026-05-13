import { FlowState, type FlowStateType } from "./states";

export type FlowEvent =
  | "BOOT_NO_SESSION"
  | "BOOT_AUTHED_FRESH_SIGNUP"
  | "BOOT_AUTHED_FIRST_RUN"
  | "BOOT_AUTHED_RESUMING"
  | "START"
  | "AUTH_SUCCESS"
  | "DECIDE_SKIP"
  | "TOUR_DONE"
  | "TOUR_SKIP"
  | "INVOICE_CREATED"
  | "OPEN_INVOICE"
  | "BACK_TO_DASHBOARD"
  | "SIGN_OUT"
  | "INVOICES_LOADED"
  | "REPLAY_TOUR";

// Allowed transitions table. Anything not listed is rejected & logged.
type Table = Partial<Record<FlowStateType, Partial<Record<FlowEvent, FlowStateType>>>>;

export const TRANSITIONS: Table = {
  [FlowState.APP_LAUNCH]: {
    BOOT_NO_SESSION: FlowState.LANDING,
    BOOT_AUTHED_FRESH_SIGNUP: FlowState.ONBOARDING,
    BOOT_AUTHED_FIRST_RUN: FlowState.DASHBOARD_EMPTY,
    BOOT_AUTHED_RESUMING: FlowState.DASHBOARD_ACTIVE,
  },
  [FlowState.LANDING]: {
    START: FlowState.ONBOARDING,
    AUTH_SUCCESS: FlowState.DASHBOARD_ACTIVE,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.ONBOARDING]: {
    DECIDE_SKIP: FlowState.FEATURE_TOUR,
    TOUR_DONE: FlowState.DASHBOARD_EMPTY,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.FEATURE_TOUR]: {
    TOUR_DONE: FlowState.DASHBOARD_EMPTY,
    TOUR_SKIP: FlowState.DASHBOARD_EMPTY,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.DASHBOARD_EMPTY]: {
    INVOICE_CREATED: FlowState.INVOICE_DETAIL,
    INVOICES_LOADED: FlowState.DASHBOARD_ACTIVE,
    OPEN_INVOICE: FlowState.INVOICE_DETAIL,
    AUTH_SUCCESS: FlowState.DASHBOARD_ACTIVE,
    REPLAY_TOUR: FlowState.FEATURE_TOUR,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.DASHBOARD_ACTIVE]: {
    OPEN_INVOICE: FlowState.INVOICE_DETAIL,
    INVOICES_LOADED: FlowState.DASHBOARD_ACTIVE,
    INVOICE_CREATED: FlowState.DASHBOARD_ACTIVE,
    REPLAY_TOUR: FlowState.FEATURE_TOUR,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.INVOICE_DETAIL]: {
    BACK_TO_DASHBOARD: FlowState.DASHBOARD_ACTIVE,
    OPEN_INVOICE: FlowState.INVOICE_DETAIL,
    SIGN_OUT: FlowState.LANDING,
  },
};

export function resolveTransition(
  from: FlowStateType,
  event: FlowEvent,
): FlowStateType | null {
  const next = TRANSITIONS[from]?.[event];
  if (!next) {
    if (typeof console !== "undefined") {
      console.warn(`[FLOW] rejected transition: ${from} --(${event})--> ?`);
    }
    return null;
  }
  return next;
}
