import { ArrowRight, Sparkles } from "lucide-react";
import { useFlow } from "@/flow/FlowMachine";

export default function PreDashboardDecisionScreen() {
  const { send, pending, setPending } = useFlow();

  function handle(decision: "yes" | "skip") {
    if (pending) return;
    setPending(true);
    // Release the lock on next tick so the navigation can settle.
    setTimeout(() => setPending(false), 400);
    send(decision === "yes" ? "DECIDE_YES" : "DECIDE_SKIP");
  }

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center px-6 animate-page-enter">
      <div className="w-full max-w-sm">
        <div className="inline-flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full mb-4">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-xs font-semibold text-accent-foreground uppercase tracking-wider">
            You're in
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          Ready to set up your first follow-up?
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Add the invoice you want chased — we'll draft the reminders, you choose when they go. Or skip and explore first.
        </p>

        <div className="mt-8 flex flex-col gap-2.5">
          <button
            onClick={() => handle("yes")}
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-60"
          >
            Set up my first follow-up <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => handle("skip")}
            disabled={pending}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-muted-foreground border border-border bg-card transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-60"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
