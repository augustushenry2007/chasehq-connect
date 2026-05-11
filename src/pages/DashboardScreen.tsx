import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices } from "@/hooks/useSupabaseData";
import { getStats, getChaseFeed, formatUSD } from "@/lib/data";
import { useApp } from "@/context/AppContext";
import { StatusBadge } from "@/components/StatusBadge";
import { useFlow } from "@/flow/FlowMachine";
import {
  TrendingUp, AlertCircle, CheckCircle, Check,
  Plus, FileText, Sparkles, Clock, Pen, ChevronRight,
} from "lucide-react";
import { CoachHint } from "@/components/onboarding/CoachHint";
import { useMissedSteps } from "@/hooks/useMissedSteps";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import NewInvoiceModal from "@/components/invoice/NewInvoiceModal";
import TrialBanner from "@/components/TrialBanner";
import NotificationBell from "@/components/NotificationBell";
import { displayNamePromptShownKey } from "@/lib/storageKeys";

type StatTone = "primary" | "warm" | "success" | "neutral";

function StatCard({ label, value, sub, icon: Icon, valueColor, onClick, tone = "neutral" }: {
  label: string; value: string; sub: string; icon: React.ElementType; valueColor?: string; onClick?: () => void; tone?: StatTone;
}) {
  const interactive = !!onClick;
  const Elem = interactive ? "button" : "div";
  const topBorder =
    tone === "primary" ? "hsl(var(--primary) / 0.45)"
    : tone === "warm" ? "hsl(28 90% 60% / 0.45)"
    : tone === "success" ? "hsl(142 70% 45% / 0.40)"
    : "hsl(var(--border))";
  const tileCls =
    tone === "primary" ? "bg-accent/60 text-primary"
    : tone === "warm" ? "bg-[hsl(var(--warm-100))] text-orange-700"
    : tone === "success" ? "bg-emerald-100 text-emerald-700"
    : "bg-muted text-muted-foreground";
  return (
    <Elem
      {...(interactive ? { onClick } : { "aria-disabled": true })}
      style={{
        borderTop: `2px solid ${topBorder}`,
        boxShadow: "var(--shadow-card)",
      }}
      className={`flex-1 bg-card border border-border rounded-2xl p-4 text-left transition-shadow ${interactive ? "hover:shadow-[var(--shadow-card-lg)] active:scale-[0.98]" : "cursor-default"}`}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tileCls}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-[22px] font-bold tracking-[-0.02em] ${interactive ? "" : "opacity-50"}`} style={{ color: valueColor || "hsl(var(--foreground))" }}>{value}</p>
      <p className={`text-xs text-muted-foreground mt-0.5 ${interactive ? "" : "opacity-50"}`}>{sub}</p>
    </Elem>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { user, fullName, isAuthenticated, profileReady, updateDisplayName } = useApp();
  const { invoices, loading, refetch } = useInvoices();
  const { missed: missedSteps } = useMissedSteps();
  const { send: flowSend } = useFlow();
  const [showNew, setShowNew] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [promptName, setPromptName] = useState("");
  useEffect(() => {
    if (!isAuthenticated || !profileReady || fullName) return;
    const email = user?.email || "";
    const localPart = email.split("@")[0].split("+")[0].toLowerCase().replace(/[._-]/g, "");
    const genericNames = new Set(["billing", "info", "hello", "contact", "admin", "support", "noreply", "notifications", "mail", "team", "help", "accounts", "invoice", "invoices", "payments"]);
    if (!genericNames.has(localPart)) return;
    const key = displayNamePromptShownKey(user?.id);
    if (localStorage.getItem(key)) return;
    setNamePromptOpen(true);
  }, [isAuthenticated, profileReady, fullName, user?.id, user?.email]);



  const stats = getStats(invoices);
  const chaseFeed = getChaseFeed(invoices);
  const isEmpty = invoices.length === 0;

  if (loading) {
    return (
      <div className="flex-1 overflow-hidden pb-24 pt-[env(safe-area-inset-top,0px)]">
        <div className="px-5 pt-5">
          <div className="h-6 w-48 bg-muted rounded-md animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded-md animate-pulse mt-2" />
          <div className="flex gap-3 mt-5">
            <div className="flex-1 h-24 bg-card border border-border rounded-2xl animate-pulse" />
            <div className="flex-1 h-24 bg-card border border-border rounded-2xl animate-pulse" />
          </div>
          <div className="mt-3 h-24 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="mt-5 h-40 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="mt-4 h-32 bg-card border border-border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const raw = fullName?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0];
  const firstName = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined;
  const greetingText = firstName ? `${greeting()}, ${firstName}` : greeting();

  return (
    <div className="flex-1 flex flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)] animate-page-enter">
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
      <TrialBanner />
      {isAuthenticated && missedSteps.length > 0 && (
        <button
          onClick={() => navigate("/catchup")}
          className="mx-5 mt-3 w-[calc(100%-2.5rem)] block text-left rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 transition-all active:scale-[0.99]"
        >
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {missedSteps.length} follow-up{missedSteps.length === 1 ? "" : "s"} ready to review
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
            You were offline — these were scheduled while you were away.
          </p>
          <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 dark:text-amber-200">
            Review and send
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,6vw,32px)] font-bold text-foreground tracking-[-0.03em] leading-[1.1]">
              {greetingText}
            </h1>
            <p className="text-[15px] text-muted-foreground mt-1 leading-[1.5]">
              {isEmpty ? "Add your first invoice — we'll take the hardest part off your plate." : "Here's what needs your attention today."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex"><NotificationBell /></span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <StatCard
            label="Outstanding"
            value={formatUSD(stats.outstandingTotal)}
            sub={isEmpty ? "Add an invoice to get started" : `${stats.outstandingCount} invoices`}
            icon={TrendingUp}
            tone="primary"
            onClick={isEmpty ? undefined : () => navigate("/invoices")}
          />
          <StatCard
            label="Overdue"
            value={formatUSD(stats.overdueTotal)}
            sub={isEmpty ? "Nothing overdue" : `${stats.overdueCount} need action`}
            icon={AlertCircle}
            tone="warm"
            valueColor={stats.overdueCount > 0 ? "#DC2626" : undefined}
            onClick={isEmpty ? undefined : () => navigate("/invoices?filter=overdue")}
          />
          <StatCard
            label="Total Collected"
            value={formatUSD(stats.paidTotal)}
            sub={isEmpty ? "No payments yet" : `${stats.paidCount} invoices paid`}
            icon={CheckCircle}
            tone="success"
            valueColor={stats.paidCount > 0 ? "#16A34A" : undefined}
            onClick={isEmpty ? undefined : () => navigate("/invoices?filter=paid")}
          />
          <StatCard
            label="Upcoming"
            value={formatUSD(stats.upcomingTotal)}
            sub={isEmpty ? "No invoices yet" : `${stats.upcomingCount} invoices`}
            icon={Clock}
            tone="neutral"
            onClick={isEmpty ? undefined : () => navigate("/invoices?filter=upcoming")}
          />
        </div>
      </div>

      {isEmpty ? (
        <>
          {/* Empty-state hero */}
          <div className="mt-5 mx-5 card-elevated p-5 relative overflow-hidden animate-fade-in">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-accent/60 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs uppercase tracking-[0.12em] font-semibold text-primary mb-2">Get started</p>
              <h2 className="text-[22px] font-bold text-foreground tracking-[-0.02em] leading-[1.15]">Ready to create your first follow-up?</h2>
              <p className="text-[15px] text-muted-foreground mt-2 leading-[1.55] max-w-sm">
                Add an invoice to ChaseHQ and we'll draft personalized follow-ups in your tone. Send them on your schedule.
              </p>
              <button
                onClick={() => { flowSend("CREATE_INVOICE"); setShowNew(true); }}
                className="mt-5 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] hover:shadow-[0_12px_32px_rgba(91,123,142,0.30)]"
              >
                <Plus className="w-4 h-4" /> Add Your First Invoice
              </button>
            </div>
          </div>

          {/* What ChaseHQ does */}
          <div className="mx-5 mt-3 bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">What Happens Next</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                "We draft every follow-up in your tone — no blank screens.",
                "Reminders queue on the schedule you set in Settings.",
                "You review and send each one — nothing goes out without you.",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{line}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Replay tour */}
          <div className="flex justify-center mb-4 mt-2">
            <button
              onClick={() => flowSend("REPLAY_TOUR")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Replay product tour
            </button>
          </div>
        </>
      ) : (
        <>
          {/* All caught up state */}
          {chaseFeed.length === 0 && (
            <div className="mt-5 mx-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">All caught up</p>
                <p className="text-xs text-muted-foreground mt-0.5">No outstanding follow-ups right now.</p>
              </div>
            </div>
          )}

          {/* Chase Feed */}
          {chaseFeed.length > 0 && (
            <CoachHint
              hintKey="invoice_age"
              side="bottom"
              title="Older invoices rise to the top"
              body="The chase feed is sorted by days overdue — nothing gets buried. Tap any row to open the invoice."
            >
              <div className="mt-5 mx-5 bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Chase Feed</h2>
                    <p className="text-xs text-muted-foreground">Prioritized actions</p>
                  </div>
                  <button onClick={() => navigate("/invoices")} className="text-sm font-medium text-primary">View all</button>
                </div>
                {chaseFeed.map((inv, i) => (
                  <button
                    key={inv.id}
                    onClick={() => navigate(`/invoice/${inv.id}`)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${i < chaseFeed.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <span className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0 text-xs font-semibold uppercase">
                      {inv.client.charAt(0)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate capitalize">
                        {inv.client} <span className="text-muted-foreground font-normal">· {inv.id}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {formatUSD(inv.amount)} · {inv.daysPastDue > 0 ? `${inv.daysPastDue} days late` : inv.description}
                      </p>
                    </div>
                    <StatusBadge status={inv.status} />
                  </button>
                ))}
              </div>
            </CoachHint>
          )}

        </>
      )}

      </div>

      {!isEmpty && (
        <button
          onClick={() => { flowSend("CREATE_INVOICE"); setShowNew(true); }}
          aria-label="New invoice"
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] right-5 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_8px_24px_rgba(91,123,142,0.35)] hover:shadow-[0_12px_32px_rgba(91,123,142,0.40)] active:scale-[0.95] transition-all z-30"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}

      <NewInvoiceModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(invoiceId) => {
          if (!isAuthenticated) {
            flowSend("INVOICE_CREATED", { invoiceId: "guest" });
            navigate("/invoice/guest", { replace: true });
            return;
          }
          if (invoiceId) navigate(`/invoice/${invoiceId}`, { replace: true });
          refetch();
        }}
      />

      <AlertDialog open={namePromptOpen} onOpenChange={setNamePromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pen className="w-4 h-4 text-primary" />
              How should we sign your follow-ups?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your email address alone won't look great at the bottom of a follow-up. Add your name so every message ends with a personal touch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={promptName}
            onChange={(e) => setPromptName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && promptName.trim()) {
                updateDisplayName(promptName.trim());
                try { localStorage.setItem(displayNamePromptShownKey(user?.id), "1"); } catch {}
                setNamePromptOpen(false);
              }
            }}
            placeholder="e.g. Alex or Alex from Studio"
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              try { localStorage.setItem(displayNamePromptShownKey(user?.id), "1"); } catch {}
            }}>
              Skip for now
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!promptName.trim()}
              onClick={() => {
                if (!promptName.trim()) return;
                updateDisplayName(promptName.trim());
                try { localStorage.setItem(displayNamePromptShownKey(user?.id), "1"); } catch {}
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
