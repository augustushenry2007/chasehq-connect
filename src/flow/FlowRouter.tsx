import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFlow } from "./FlowMachine";
import { FlowState, ROUTE_FOR } from "./states";

/**
 * Subscribes to FlowMachine and synchronizes the URL declaratively.
 * Mounted once inside <BrowserRouter>.
 */
export function FlowRouter() {
  const { state, payload } = useFlow();
  const navigate = useNavigate();
  const location = useLocation();
  const lastStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (state === FlowState.APP_LAUNCH) return;
    // Don't redirect while OAuth callback is in progress
    const inOAuth = sessionStorage.getItem("oauth_in_progress") === "1";
    if (inOAuth) return;
    if (lastStateRef.current === state) return;
    lastStateRef.current = state;

    let target = ROUTE_FOR[state];
    if (state === FlowState.INVOICE_DETAIL && payload?.invoiceId) {
      target = `/invoice/${payload.invoiceId}`;
    }
    // Compare path only (ignore query) to avoid infinite loops with `?new=1`.
    const currentPath = location.pathname + (location.search || "");
    if (currentPath !== target) {
      navigate(target, { replace: true });
    }
  }, [state, payload, navigate, location.pathname, location.search]);

  return null;
}
