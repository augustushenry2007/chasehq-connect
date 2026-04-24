import posthog from "posthog-js";

export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    posthog.capture(event, properties);
  },

  identify: (userId: string, properties?: Record<string, any>) => {
    posthog.identify(userId, properties);
  },

  // User lifecycle events
  signUp: (email: string, method: "email" | "google" | "apple") => {
    analytics.track("user_signed_up", { email, method });
  },

  signIn: (email: string, method: "email" | "google" | "apple") => {
    analytics.track("user_signed_in", { email, method });
  },

  onboardingCompleted: (feelings?: string[], worries?: string[], goals?: string[]) => {
    analytics.track("onboarding_completed", { feelings, worries, goals });
  },

  // Invoice events
  invoiceCreated: (invoiceId: string, amount: number, currency: string) => {
    analytics.track("invoice_created", { invoiceId, amount, currency });
  },

  invoiceSent: (invoiceId: string, recipient: string, method: string) => {
    analytics.track("invoice_sent", { invoiceId, recipient, method });
  },

  invoiceMarkedPaid: (invoiceId: string, amount: number) => {
    analytics.track("invoice_marked_paid", { invoiceId, amount });
  },

  // Follow-up events
  followUpGenerated: (invoiceId: string, tone: string) => {
    analytics.track("followup_generated", { invoiceId, tone });
  },

  followUpSent: (invoiceId: string, tone: string) => {
    analytics.track("followup_sent", { invoiceId, tone });
  },

  // Subscription events
  trialStarted: (plan: string) => {
    analytics.track("trial_started", { plan });
  },

  subscriptionCreated: (plan: string, billingCycle: string) => {
    analytics.track("subscription_created", { plan, billingCycle });
  },

  subscriptionCancelled: (plan: string, reason?: string) => {
    analytics.track("subscription_cancelled", { plan, reason });
  },

  // Feature usage
  featureUsed: (featureName: string, context?: Record<string, any>) => {
    analytics.track(`feature_used_${featureName}`, context);
  },

  // Error tracking
  error: (errorName: string, errorMessage: string, context?: Record<string, any>) => {
    analytics.track("error_occurred", { errorName, errorMessage, ...context });
  },
};
