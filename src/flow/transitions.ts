import { FlowState, type FlowStateType } from "./states";

export type FlowEvent =
  | "BOOT_NO_SESSION"
  | "BOOT_AUTHED_FIRST_RUN"
  | "BOOT_AUTHED_RESUMING"
  | "BOOT_GUEST_ONBOARDED"
  | "START"
  | "ONBOARDING_DONE"
  | "AUTH_SUCCESS"
  | "DECIDE_YES"
  | "DECIDE_SKIP"
  | "INVOICE_CREATED"
  | "CREATE_INVOICE"
  | "OPEN_INVOICE"
  | "BACK_TO_DASHBOARD"
  | "REQUEST_AUTH"
  | "SIGN_OUT"
  | "INVOICES_LOADED";

// Allowed transitions table. Anything not listed is rejected & logged.
type Table = Partial<Record<FlowStateType, Partial<Record<FlowEvent, FlowStateType>>>>;

export const TRANSITIONS: Table = {
  [FlowState.APP_LAUNCH]: {
    BOOT_NO_SESSION: FlowState.LANDING,
    BOOT_GUEST_ONBOARDED: FlowState.PRE_DASHBOARD_DECISION,
    BOOT_AUTHED_FIRST_RUN: FlowState.PRE_DASHBOARD_DECISION,
    BOOT_AUTHED_RESUMING: FlowState.DASHBOARD_ACTIVE,
  },
  [FlowState.LANDING]: {
    START: FlowState.ONBOARDING,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.ONBOARDING]: {
    // Value-first: skip auth — go straight to invoice decision as a guest.
    ONBOARDING_DONE: FlowState.PRE_DASHBOARD_DECISION,
    AUTH_SUCCESS: FlowState.PRE_DASHBOARD_DECISION,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.AUTH]: {
    AUTH_SUCCESS: FlowState.DASHBOARD_ACTIVE,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.PRE_DASHBOARD_DECISION]: {
    DECIDE_YES: FlowState.CREATE_INVOICE,
    DECIDE_SKIP: FlowState.DASHBOARD_EMPTY,
    INVOICES_LOADED: FlowState.DASHBOARD_ACTIVE,
    REQUEST_AUTH: FlowState.AUTH,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.CREATE_INVOICE]: {
    // For unauth users → POST_INVOICE_AUTH (caller decides which event to send).
    INVOICE_CREATED: FlowState.POST_INVOICE_AUTH,
    BACK_TO_DASHBOARD: FlowState.DASHBOARD_EMPTY,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.POST_INVOICE_AUTH]: {
    AUTH_SUCCESS: FlowState.DASHBOARD_ACTIVE,
    BACK_TO_DASHBOARD: FlowState.DASHBOARD_EMPTY,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.DASHBOARD_EMPTY]: {
    CREATE_INVOICE: FlowState.CREATE_INVOICE,
    INVOICES_LOADED: FlowState.DASHBOARD_ACTIVE,
    OPEN_INVOICE: FlowState.INVOICE_DETAIL,
    REQUEST_AUTH: FlowState.AUTH,
    SIGN_OUT: FlowState.LANDING,
  },
  [FlowState.DASHBOARD_ACTIVE]: {
    OPEN_INVOICE: FlowState.INVOICE_DETAIL,
    CREATE_INVOICE: FlowState.CREATE_INVOICE,
    INVOICES_LOADED: FlowState.DASHBOARD_ACTIVE,
    INVOICE_CREATED: FlowState.DASHBOARD_ACTIVE,
    REQUEST_AUTH: FlowState.AUTH,
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
