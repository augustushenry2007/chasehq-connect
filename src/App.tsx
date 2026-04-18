import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { FlowProvider } from "@/flow/FlowMachine";
import { FlowBootstrap } from "@/flow/FlowBootstrap";
import { FlowRouter } from "@/flow/FlowRouter";
import RootRedirect from "./pages/RootRedirect";
import AuthScreen from "./pages/AuthScreen";
import WelcomeScreen from "./pages/WelcomeScreen";
import OnboardingScreen from "./pages/OnboardingScreen";
import PreDashboardDecisionScreen from "./pages/PreDashboardDecisionScreen";
import TabLayout from "./components/TabLayout";
import DashboardScreen from "./pages/DashboardScreen";
import InvoicesScreen from "./pages/InvoicesScreen";
import InvoiceDetailScreen from "./pages/InvoiceDetailScreen";
import SettingsScreen from "./pages/SettingsScreen";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfUse from "./pages/legal/TermsOfUse";
import NotFound from "./pages/NotFound";
import PaywallScreen from "./pages/PaywallScreen";
import BillingScreen from "./pages/BillingScreen";
import RequireOnboarding from "./components/RequireOnboarding";
import ErrorBoundary from "./components/ErrorBoundary";

const App = () => (
  <AppProvider>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <FlowProvider>
          <FlowBootstrap />
          <FlowRouter />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/welcome" element={<WelcomeScreen />} />
              <Route path="/auth" element={<AuthScreen />} />
              <Route path="/onboarding" element={<OnboardingScreen />} />
              <Route element={<RequireOnboarding />}>
                <Route path="/pre-dashboard" element={<PreDashboardDecisionScreen />} />
                <Route element={<TabLayout />}>
                  <Route path="/dashboard" element={<DashboardScreen />} />
                  <Route path="/invoices" element={<InvoicesScreen />} />
                  <Route path="/settings" element={<SettingsScreen />} />
                </Route>
                <Route path="/invoice/:id" element={<InvoiceDetailScreen />} />
                <Route path="/settings/billing" element={<BillingScreen />} />
              </Route>
              <Route path="/paywall" element={<PaywallScreen />} />
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

export default App;
