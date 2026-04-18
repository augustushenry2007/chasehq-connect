// Centralized flow state machine — single source of truth for major navigation.
export const FlowState = {
  APP_LAUNCH: "APP_LAUNCH",
  LANDING: "LANDING",
  ONBOARDING: "ONBOARDING",
  AUTH: "AUTH",
  PRE_DASHBOARD_DECISION: "PRE_DASHBOARD_DECISION",
  CREATE_INVOICE: "CREATE_INVOICE",
  POST_INVOICE_AUTH: "POST_INVOICE_AUTH",
  DASHBOARD_EMPTY: "DASHBOARD_EMPTY",
  DASHBOARD_ACTIVE: "DASHBOARD_ACTIVE",
  INVOICE_DETAIL: "INVOICE_DETAIL",
} as const;

export type FlowStateType = (typeof FlowState)[keyof typeof FlowState];

// Maps a flow state to the URL path the router should render.
// INVOICE_DETAIL is dynamic and resolved by FlowRouter via payload.
export const ROUTE_FOR: Record<FlowStateType, string> = {
  APP_LAUNCH: "/",
  LANDING: "/welcome",
  ONBOARDING: "/onboarding",
  AUTH: "/auth",
  PRE_DASHBOARD_DECISION: "/pre-dashboard",
  CREATE_INVOICE: "/invoices?new=1",
  POST_INVOICE_AUTH: "/auth-after-invoice",
  DASHBOARD_EMPTY: "/dashboard",
  DASHBOARD_ACTIVE: "/dashboard",
  INVOICE_DETAIL: "/invoice",
};

export const FLOW_STORAGE_KEY = "flow_state_v1";
export const FIRST_RUN_SESSION_KEY = "flow_first_run_session";
