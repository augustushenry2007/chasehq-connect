import { BrowserRouter, Route, Routes } from "react-router-dom";
import posthog from "posthog-js";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { FlowProvider } from "@/flow/FlowMachine";
import { FlowBootstrap } from "@/flow/FlowBootstrap";
import { FlowRouter } from "@/flow/FlowRouter";
import { supabase } from "@/integrations/supabase/client";
import { attachNotificationTapHandler } from "@/lib/localNotifications";
import { useReconcileLocalNotifications } from "@/hooks/useReconcileLocalNotifications";
import { useBackfillMissingSchedules } from "@/hooks/useBackfillMissingSchedules";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import RootRedirect from "./pages/RootRedirect";
import AuthScreen from "./pages/AuthScreen";
import WelcomeScreen from "./pages/WelcomeScreen";
import OnboardingScreen from "./pages/OnboardingScreen";
import TabLayout from "./components/TabLayout";
import DashboardScreen from "./pages/DashboardScreen";
import InvoicesScreen from "./pages/InvoicesScreen";
import InvoiceDetailScreen from "./pages/InvoiceDetailScreen";
import SettingsScreen from "./pages/SettingsScreen";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfUse from "./pages/legal/TermsOfUse";
import NotFound from "./pages/NotFound";
import BillingScreen from "./pages/BillingScreen";
import PostInvoiceAuthScreen from "./pages/PostInvoiceAuthScreen";
import GuestDraftScreen from "./pages/GuestDraftScreen";
import RequireOnboarding from "./components/RequireOnboarding";
import ErrorBoundary from "./components/ErrorBoundary";
import { OAuthOverlay } from "./components/OAuthOverlay";
import FeatureTourScreen from "./pages/FeatureTourScreen";
import CatchupScreen from "./pages/CatchupScreen";

if (!import.meta.env.DEV) {
  posthog.init("phc_wJX7KNbpWUKXJqhFqEfbyL1K6jrJXXbrbhUseThquMey", {
    api_host: "https://us.i.posthog.com",
  });
}

if (Capacitor.isNativePlatform()) {
  attachNotificationTapHandler();

  // Broadcast app foreground/resume so hooks can re-run launch-time reconciliation
  // (OS local notifications can be purged by iOS while the app sits backgrounded
  // for days — see useReconcileLocalNotifications).
  CapApp.addListener("appStateChange", ({ isActive }) => {
    if (isActive) window.dispatchEvent(new Event("chasehq:app-resumed"));
  });

  CapApp.addListener("appUrlOpen", async ({ url }) => {
    // Gmail OAuth callback — fired when SFSafariViewController returns to the app.
    if (url.startsWith("com.chasehq.app://gmail-oauth")) {
      try { await Browser.close(); } catch { /* already closed */ }
      const qIdx = url.indexOf("?");
      const params = qIdx >= 0 ? new URLSearchParams(url.slice(qIdx + 1)) : new URLSearchParams();
      if (params.get("gmail_connected") === "true") {
        window.dispatchEvent(new CustomEvent("chasehq:gmail-connected"));
      } else {
        const err = params.get("gmail_error") ?? "Unknown error";
        window.dispatchEvent(new CustomEvent<string>("chasehq:gmail-error", { detail: err }));
      }
      return;
    }

    if (!url.startsWith("com.chasehq.app://auth-after-invoice")) return;

    const hashIdx = url.indexOf("#");
    const params = hashIdx >= 0 ? new URLSearchParams(url.slice(hashIdx + 1)) : null;
    const access_token = params?.get("access_token") ?? null;
    const refresh_token = params?.get("refresh_token") ?? null;

    if (access_token && refresh_token) {
      // Signal BEFORE Browser.close() — the WKWebView runs JS in the background
      // while the Safari View Controller animates closed (~300ms). Dispatching here
      // gives React time to flush the spinner render before the user sees the app,
      // eliminating the AuthForm flash. FlowBootstrap remains the canonical owner
      // of clearing this flag.
      sessionStorage.setItem(STORAGE_KEYS.OAUTH_COMPLETED, "1");
      window.dispatchEvent(new Event("chasehq:oauth-signal"));
    }

    try { await Browser.close(); } catch { /* no-op if already closed */ }

    if (access_token && refresh_token) {
      try {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
      } catch (e) {
        // setSession failed (network blip at the OAuth-return moment). Roll back the
        // optimistic "completed" signal so OAuthOverlay dismisses to the auth form
        // immediately instead of hanging on the 90s safety net.
        console.error("[OAuth] setSession failed after callback:", e);
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
        window.dispatchEvent(new Event("chasehq:oauth-signal"));
        window.history.pushState({}, "", "/auth-after-invoice");
        window.dispatchEvent(new PopStateEvent("popstate"));
        toast.error("Sign-in didn't go through. Give it another try.");
        return;
      }
    }

    window.history.pushState({}, "", "/auth-after-invoice");
    window.dispatchEvent(new PopStateEvent("popstate"));
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
  });

  // If the user dismisses the SVC without completing OAuth, appUrlOpen never fires.
  // Clear OAUTH_IN_PROGRESS so PostInvoiceAuthScreen exits the spinner state and shows
  // AuthForm again. When OAuth succeeds, OAUTH_COMPLETED is already "1" by the time
  // browserFinished fires (we set it before Browser.close()), so this is a no-op.
  Browser.addListener("browserFinished", () => {
    if (sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) !== "1") {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      window.dispatchEvent(new Event("chasehq:oauth-signal"));
    }
  });
}

function NativeReconciler() {
  useReconcileLocalNotifications();
  useBackfillMissingSchedules();
  return null;
}

const AppNative = () => (
  <AppProvider>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <FlowProvider>
          <FlowBootstrap />
          <FlowRouter />
          <OAuthOverlay />
          <NativeReconciler />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/welcome" element={<WelcomeScreen />} />
              <Route path="/auth" element={<AuthScreen />} />
              <Route path="/onboarding" element={<OnboardingScreen />} />
              <Route path="/auth-after-invoice" element={<PostInvoiceAuthScreen />} />
              <Route path="/guest-draft" element={<GuestDraftScreen />} />
              <Route path="/tour" element={<FeatureTourScreen />} />
              <Route element={<RequireOnboarding />}>
                <Route element={<TabLayout />}>
                  <Route path="/dashboard" element={<DashboardScreen />} />
                  <Route path="/invoices" element={<InvoicesScreen />} />
                  <Route path="/settings" element={<SettingsScreen />} />
                </Route>
                <Route path="/invoice/:id" element={<InvoiceDetailScreen />} />
                <Route path="/settings/billing" element={<BillingScreen />} />
                <Route path="/catchup" element={<CatchupScreen />} />
              </Route>
              <Route path="/legal/privacy" element={<PrivacyPolicy />} />
              <Route path="/legal/terms" element={<TermsOfUse />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </FlowProvider>
      </BrowserRouter>
    </TooltipProvider>
  </AppProvider>
);

export default AppNative;
