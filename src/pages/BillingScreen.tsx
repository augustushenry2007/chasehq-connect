import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlement } from "@/hooks/useEntitlement";
import { openManageSubscriptions, restorePurchases } from "@/lib/iap";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
  none: { label: "No subscription", tone: "muted" },
  trialing: { label: "Free trial", tone: "ok" },
  active: { label: "Active", tone: "ok" },
  past_due: { label: "Payment past due", tone: "warn" },
  canceled: { label: "Canceled", tone: "warn" },
  expired: { label: "Expired", tone: "muted" },
};

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BillingScreen() {
  const navigate = useNavigate();
  const ent = useEntitlement();
  const [restoring, setRestoring] = useState(false);

  const meta = STATUS_LABEL[ent.status] ?? STATUS_LABEL.none;
  const toneClass =
    meta.tone === "ok" ? "bg-primary/10 text-primary" :
    meta.tone === "warn" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" :
    "bg-muted text-muted-foreground";

  async function handleRestore() {
    setRestoring(true);
    const result = await restorePurchases();
    if (!result.ok) {
      setRestoring(false);
      toast.error(result.error);
      return;
    }
    const { data, error } = await supabase.functions.invoke("validate-apple-receipt", {
      body: { receipt: result.receipt, productId: result.productId, mock: result.mock, restore: true },
    });
    setRestoring(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "Nothing to restore");
      return;
    }
    toast.success("Subscription restored");
    await ent.refetch();
  }

  return (
    <div className="h-screen bg-background overflow-y-auto overscroll-contain">
      <div className="max-w-md mx-auto px-5 pt-5 pb-[max(env(safe-area-inset-bottom,16px),32px)]">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-xl font-bold text-foreground mb-1">Billing</h1>
        <p className="text-xs text-muted-foreground mb-5">Manage your ChaseHQ subscription.</p>

        {/* Status card */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">ChaseHQ Pro</p>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${toneClass}`}>
                  {meta.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">$5 / month</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-xs">
            {ent.isTrialing ? (
              <>
                <div>
                  <p className="text-muted-foreground">Trial ends</p>
                  <p className="text-foreground font-medium mt-0.5">{formatDate(ent.trialEndsAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Days left</p>
                  <p className="text-foreground font-medium mt-0.5">{ent.daysLeftInTrial ?? "—"}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-muted-foreground">Next billing date</p>
                  <p className="text-foreground font-medium mt-0.5">{formatDate(ent.nextBillingDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plan</p>
                  <p className="text-foreground font-medium mt-0.5">Monthly</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        {!ent.isActive && !ent.isTrialing && (
          <button
            onClick={() => navigate("/paywall")}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold mb-3"
          >
            Start Free Trial
          </button>
        )}

        <button
          onClick={openManageSubscriptions}
          className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 mb-2 hover:border-primary/40 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Manage subscription</p>
            <p className="text-[11px] text-muted-foreground">Change plan, payment, or cancel</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          onClick={handleRestore}
          disabled={restoring}
          className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Restore purchases</p>
            <p className="text-[11px] text-muted-foreground">If you've subscribed on another device</p>
          </div>
          {restoring ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <RefreshCw className="w-4 h-4 text-muted-foreground" />}
        </button>

        <p className="text-[11px] text-muted-foreground mt-5 leading-relaxed">
          Subscriptions are billed through Apple. Auto-renews monthly until canceled at least 24 hours before the end of the current period. Cancel anytime in App Store settings — your access continues until the end of your billing period.
        </p>
      </div>
    </div>
  );
}
