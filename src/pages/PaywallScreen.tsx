import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlement } from "@/hooks/useEntitlement";
import { purchaseSubscription, restorePurchases } from "@/lib/iap";

export default function PaywallScreen() {
  const navigate = useNavigate();
  const { status, isTrialing, isActive, refetch } = useEntitlement();
  const [busy, setBusy] = useState<"trial" | "purchase" | "restore" | null>(null);

  const hasStartedTrial = status !== "none";
  const ctaLabel = isActive
    ? "You're subscribed"
    : isTrialing
    ? "Subscribe — $5/month"
    : hasStartedTrial
    ? "Subscribe — $5/month"
    : "Start Free Trial";

  async function handleStartTrial() {
    setBusy("trial");
    const { data, error } = await supabase.functions.invoke("start-trial");
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not start trial");
      return;
    }
    toast.success("Your 30-day free trial has started");
    await refetch();
    navigate(-1);
  }

  async function handlePurchase() {
    setBusy("purchase");
    const result = await purchaseSubscription();
    if (!result.ok) {
      setBusy(null);
      if (!result.canceled) toast.error(result.error);
      return;
    }
    const { data, error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: { receipt: result.receipt, productId: result.productId, mock: result.mock },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not verify purchase");
      return;
    }
    toast.success("You're subscribed — thank you!");
    await refetch();
    navigate(-1);
  }

  async function handleRestore() {
    setBusy("restore");
    const result = await restorePurchases();
    if (!result.ok) {
      setBusy(null);
      toast.error(result.error);
      return;
    }
    const { data, error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: { receipt: result.receipt, productId: result.productId, mock: result.mock, restore: true },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Nothing to restore");
      return;
    }
    toast.success("Subscription restored");
    await refetch();
  }

  function primaryAction() {
    if (isActive) { navigate("/settings/billing"); return; }
    if (hasStartedTrial) handlePurchase();
    else handleStartTrial();
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
            Keep follow-ups flowing
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            ChaseHQ takes the awkward out of getting paid. Calm, on-brand reminders that go out for you — so you never have to chase again.
          </p>

          <div className="mt-8 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground">$5</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hasStartedTrial ? "After your free trial." : "After your 30-day free trial."}
            </p>

            <ul className="mt-5 space-y-2.5">
              {[
                "Unlimited AI follow-ups",
                "Auto-chase on your schedule",
                "Final-notice escalation",
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
            {busy === "trial" || busy === "purchase" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
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
    </div>
  );
}
