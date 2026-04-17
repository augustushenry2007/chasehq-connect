import { useNavigate } from "react-router-dom";
import { Sparkles, AlertCircle } from "lucide-react";
import { useEntitlement } from "@/hooks/useEntitlement";

export default function TrialBanner() {
  const navigate = useNavigate();
  const { isTrialing, isPastDue, daysLeftInTrial, loading } = useEntitlement();

  if (loading) return null;

  if (isPastDue) {
    return (
      <div className="mx-5 mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">Payment issue</p>
          <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed mt-0.5">
            Update your billing in App Store settings to keep ChaseHQ active.
          </p>
        </div>
        <button
          onClick={() => navigate("/settings/billing")}
          className="text-[11px] font-semibold text-amber-900 dark:text-amber-100 underline shrink-0 mt-0.5"
        >
          Manage
        </button>
      </div>
    );
  }

  if (!isTrialing || daysLeftInTrial == null || daysLeftInTrial > 7) return null;

  const urgent = daysLeftInTrial <= 1;
  const label =
    daysLeftInTrial === 0 ? "Your trial ends today" :
    daysLeftInTrial === 1 ? "Your trial ends tomorrow" :
    `${daysLeftInTrial} days left in your trial`;

  return (
    <div
      className={`mx-5 mt-3 flex items-center gap-2.5 p-3 rounded-xl border ${
        urgent
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50"
          : "bg-accent border-primary/20"
      }`}
    >
      <Sparkles className={`w-4 h-4 shrink-0 ${urgent ? "text-amber-600" : "text-primary"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${urgent ? "text-amber-900 dark:text-amber-100" : "text-foreground"}`}>
          {label}
        </p>
        <p className={`text-[11px] leading-relaxed ${urgent ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>
          Keep follow-ups flowing for $5/month. Cancel anytime.
        </p>
      </div>
      <button
        onClick={() => navigate("/paywall")}
        className={`text-[11px] font-semibold rounded-lg px-2.5 py-1.5 shrink-0 ${
          urgent ? "bg-amber-600 text-white" : "bg-primary text-primary-foreground"
        }`}
      >
        {urgent ? "Subscribe" : "View plan"}
      </button>
    </div>
  );
}
