import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlement } from "@/hooks/useEntitlement";
import MockIAPSheet from "@/components/onboarding/MockIAPSheet";
import { purchaseSubscription, restorePurchases, isNativePlatform } from "@/lib/iap";

export default function PaywallScreen() {
  const navigate = useNavigate();
  const { status, isTrialing, isActive, refetch } = useEntitlement();
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);
  const [mockIapOpen, setMockIapOpen] = useState(false);

  const hasStartedTrial = status !== "none";
  const ctaLabel = isActive
    ? "You're subscribed"
    : isTrialing
    ? "Subscribe — $19.99/month"
    : hasStartedTrial
    ? "Subscribe — $19.99/month"
    : "Start Free Trial";

  async function runPurchaseFlow() {
    setBusy("purchase");
    const result = await purchaseSubscription();
    if (!result.ok) {
      setBusy(null);
      if (!result.canceled) toast.error(result.error);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const { data, error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: { receipt: result.receipt, productId: result.productId, mock: result.mock },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "We couldn't verify that purchase yet. Give it a moment and try restoring.");
      return;
    }
    toast.success("You're subscribed — thank you!");
    await refetch();
    navigate(-1);
  }

  function handlePurchase() {
    if (!isNativePlatform()) {
      setMockIapOpen(true);
      return;
    }
    runPurchaseFlow();
  }

  async function handleMockIapConfirm() {
    setMockIapOpen(false);
    await runPurchaseFlow();
  }

  async function handleRestore() {
    setBusy("restore");
    const result = await restorePurchases();
    if (!result.ok) {
      setBusy(null);
      toast.error(result.error);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const { data, error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: { receipt: result.receipt, productId: result.productId, mock: result.mock, restore: true },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "No active subscription found on this account.");
      return;
    }
    toast.success("You're all set — welcome back.");
    await refetch();
  }

  function primaryAction() {
    if (isActive) { navigate("/settings/billing"); return; }
    handlePurchase();
  }

  return (
    <div className="h-screen bg-background overflow-y-auto overscroll-contain">
      <div className="max-w-md mx-auto px-5 pt-5 pb-[max(env(safe-area-inset-bottom,16px),32px)] flex flex-col min-h-full">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex-1 flex flex-col justify-center py-10">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-5">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">
            Done-for-you follow-ups, on your schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            ChaseHQ drafts every reminder in your tone and queues it on the cadence you set — so getting paid stops feeling awkward.
          </p>

          <div className="mt-8 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground">$19.99</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hasStartedTrial ? "After your free trial." : "After your 14-day free trial."}
            </p>

            <ul className="mt-5 space-y-2.5">
              {[
                "Unlimited AI follow-ups",
                "Your schedule — you decide when reminders go",
                "Escalation built in — so you don't have to be the bad guy",
                "Cancel anytime",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-primary" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={primaryAction}
            disabled={busy !== null || isActive}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy === "purchase" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {ctaLabel}
          </button>

          <button
            onClick={handleRestore}
            disabled={busy !== null}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {busy === "restore" ? "Restoring…" : "Restore purchases"}
          </button>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Subscriptions auto-renew monthly until canceled. Manage or cancel anytime in App Store settings.
            By continuing you agree to our{" "}
            <button onClick={() => navigate("/legal/terms")} className="underline">Terms</button>{" "}
            and{" "}
            <button onClick={() => navigate("/legal/privacy")} className="underline">Privacy Policy</button>.
          </p>
        </div>
      </div>

      <MockIAPSheet
        open={mockIapOpen}
        onConfirm={handleMockIapConfirm}
        onCancel={() => setMockIapOpen(false)}
      />
    </div>
  );
}
