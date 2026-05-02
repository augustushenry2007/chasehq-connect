import { BrowserRouter, Route, Routes } from "react-router-dom";
import posthog from "posthog-js";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { FlowProvider } from "@/flow/FlowMachine";
import { FlowBootstrap } from "@/flow/FlowBootstrap";
import { FlowRouter } from "@/flow/FlowRouter";
import { supabase } from "@/integrations/supabase/client";
import { attachNotificationTapHandler } from "@/lib/localNotifications";
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

  CapApp.addListener("appUrlOpen", async ({ url }) => {
    if (!url.startsWith("com.chasehq.app://auth-after-invoice")) return;

    const hashIdx = url.indexOf("#");
    const params = hashIdx >= 0 ? new URLSearchParams(url.slice(hashIdx + 1)) : null;
    const access_token = params?.get("access_token") ?? null;
    const refresh_token = params?.get("refresh_token") ?? null;
    const provider_token = params?.get("provider_token") ?? null;
    const provider_refresh_token = params?.get("provider_refresh_token") ?? null;

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
      const { data: sessionData } = await supabase.auth.setSession({ access_token, refresh_token });
      // setSession does not carry provider_token through to the SIGNED_IN event, so
      // the AppContext upsert never fires on native iOS. Persist Gmail tokens here,
      // before navigating, so useSendingMailbox finds the row on its first fetch.
      if (sessionData.session && provider_token && provider_refresh_token) {
        const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();
        await supabase.from("gmail_connections").upsert({
          user_id: sessionData.session.user.id,
          email: sessionData.session.user.email,
          access_token: provider_token,
          refresh_token: provider_refresh_token,
          token_expires_at: expiresAt,
        }, { onConflict: "user_id" });
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

const AppNative = () => (
  <AppProvider>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <FlowProvider>
          <FlowBootstrap />
          <FlowRouter />
          <OAuthOverlay />
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
