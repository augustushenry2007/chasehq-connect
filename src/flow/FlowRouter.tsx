import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFlow } from "./FlowMachine";
import { FlowState, ROUTE_FOR } from "./states";

/**
 * Subscribes to FlowMachine and synchronizes the URL declaratively.
 * Mounted once inside <BrowserRouter>.
 *
 * Note: the rotation race (Supabase emits SIGNED_OUT briefly before SIGNED_IN
 * on native ID-token sign-in) is handled in FlowBootstrap by suppressing the
 * SIGN_OUT dispatch while OAUTH_COMPLETED is set. FlowRouter must NOT add its
 * own sessionStorage gate here — those flags are cleared via setTimeout from
 * OAuthOverlay's safety nets, which don't change any React dep, so a gate
 * here would deadlock the route forever once the FSM transitions but the
 * flags happen to still be set.
 */
export function FlowRouter() {
  const { state, payload } = useFlow();
  const navigate = useNavigate();
  const location = useLocation();
  const lastStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (state === FlowState.APP_LAUNCH) return;
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
