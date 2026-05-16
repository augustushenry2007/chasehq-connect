import { BrowserRouter, Route, Routes } from "react-router-dom";
import posthog from "posthog-js";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { FlowProvider } from "@/flow/FlowMachine";
import { FlowBootstrap } from "@/flow/FlowBootstrap";
import { FlowRouter } from "@/flow/FlowRouter";
import { attachNotificationTapHandler } from "@/lib/localNotifications";
import { useReconcileLocalNotifications } from "@/hooks/useReconcileLocalNotifications";
import { useBackfillMissingSchedules } from "@/hooks/useBackfillMissingSchedules";
import RootRedirect from "./pages/RootRedirect";
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
import RequireOnboarding from "./components/RequireOnboarding";
import ErrorBoundary from "./components/ErrorBoundary";
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
          <NativeReconciler />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/welcome" element={<WelcomeScreen />} />
              <Route path="/onboarding" element={<OnboardingScreen />} />
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
