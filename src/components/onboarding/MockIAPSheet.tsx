import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import appLogo from "@/assets/app-logo.png";

type Phase = "idle" | "confirming" | "success";

interface MockIAPSheetProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MockIAPSheet({ open, onConfirm, onCancel }: MockIAPSheetProps) {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (!open) setPhase("idle");
  }, [open]);

  if (!open) return null;

  async function handleSubscribe() {
    if (phase !== "idle") return;
    setPhase("confirming");
    await new Promise((r) => setTimeout(r, 1200));
    setPhase("success");
    await new Promise((r) => setTimeout(r, 800));
    onConfirm();
  }

  const busy = phase !== "idle";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-3xl shadow-2xl p-6 pb-[max(env(safe-area-inset-bottom,16px),24px)] animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-border mb-5" />

        <div className="flex items-center gap-3 mb-4">
          <img src={appLogo} alt="ChaseHQ" className="w-12 h-12 rounded-xl shadow-sm" />
          <div>
            <p className="text-sm font-semibold text-foreground">ChaseHQ</p>
            <p className="text-xs text-muted-foreground">Auto-renewing subscription</p>
          </div>
        </div>

        <div className="bg-muted/60 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">14-day free trial</p>
              <p className="text-xs text-muted-foreground mt-0.5">Then $20/month</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-full">
              Free
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed text-center mb-5">
          Cancel anytime before your trial ends. You'll be reminded 3 days before your first charge.
        </p>

        <button
          onClick={handleSubscribe}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-90"
        >
          {phase === "idle" && "Subscribe"}
          {phase === "confirming" && (<><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>)}
          {phase === "success"    && (<><Check className="w-4 h-4" /> Trial started</>)}
        </button>

        <button
          onClick={onCancel}
          disabled={busy}
          className="mt-2 w-full py-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
