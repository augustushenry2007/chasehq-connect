import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices } from "@/hooks/useSupabaseData";
import { getStats, getChaseFeed, formatUSD } from "@/lib/data";
import { useApp } from "@/context/AppContext";
import { StatusBadge, STATUS_CONFIG } from "@/components/StatusBadge";
import { useFlow } from "@/flow/FlowMachine";
import {
  TrendingUp, AlertTriangle, CheckCircle, Check,
  Plus, FileText, Sparkles, ArrowRight,
} from "lucide-react";
import NewInvoiceModal from "@/components/invoice/NewInvoiceModal";
import TrialBanner from "@/components/TrialBanner";
import NotificationBell from "@/components/NotificationBell";

function StatCard({ label, value, sub, icon: Icon, iconColor, valueColor }: {
  label: string; value: string; sub: string; icon: React.ElementType; iconColor: string; valueColor?: string;
}) {
  return (
    <div className="flex-1 bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color: valueColor || "hsl(var(--foreground))" }}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { user, fullName, isAuthenticated } = useApp();
  const { invoices, loading, refetch } = useInvoices();
  const { send: flowSend } = useFlow();
  const [showNew, setShowNew] = useState(false);

  const stats = getStats(invoices);
  const chaseFeed = getChaseFeed(invoices);
  const isEmpty = invoices.length === 0;

  if (loading) {
    return (
      <div className="flex-1 overflow-hidden pb-24">
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

  const firstName = fullName?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="flex-1 overflow-auto pb-24 animate-page-enter">
      <TrialBanner />
      {!isAuthenticated && (
        <button
          onClick={() => flowSend("REQUEST_AUTH")}
          className="w-full bg-accent/60 border-b border-border px-5 py-2.5 text-left flex items-center justify-between transition-colors active:bg-accent"
        >
          <span className="text-xs text-foreground">
            <span className="font-semibold">You're exploring as a guest.</span>{" "}
            <span className="text-muted-foreground">Create an account to save your work</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
        </button>
      )}
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">
              {isEmpty ? `Welcome, ${firstName}` : `${greeting()}, ${firstName}`}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEmpty ? "Let's get you set up so ChaseHQ can chase invoices for you." : "Here's what needs your attention today."}
            </p>
          </div>
          <NotificationBell />
        </div>

        <div className="flex gap-3 mt-5">
          <StatCard
            label="Outstanding"
            value={formatUSD(stats.outstandingTotal)}
            sub={isEmpty ? "Add an invoice to start" : `${stats.outstandingCount} invoices`}
            icon={TrendingUp}
            iconColor="#3B82F6"
          />
          <StatCard
            label="Overdue"
            value={formatUSD(stats.overdueTotal)}
            sub={isEmpty ? "Nothing overdue" : `${stats.overdueCount} need action`}
            icon={AlertTriangle}
            iconColor="#F59E0B"
            valueColor={stats.overdueCount > 0 ? "#DC2626" : undefined}
          />
        </div>
        <div className="mt-3">
          <StatCard
            label="Paid this Month"
            value={formatUSD(stats.paidTotal)}
            sub={isEmpty ? "No payments yet" : `${stats.paidCount} invoices collected`}
            icon={CheckCircle}
            iconColor="#22C55E"
            valueColor={stats.paidCount > 0 ? "#16A34A" : undefined}
          />
        </div>
      </div>

      {isEmpty ? (
        <>
          {/* Empty-state hero */}
          <div className="mt-5 mx-5 bg-card border border-border rounded-2xl p-5 relative overflow-hidden animate-fade-in">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-accent/60" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="text-lg font-bold text-foreground">No invoices yet — let's create your first one</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Tell us who owes you and how much. We'll handle the awkward part — drafting and sending the follow-ups for you.
              </p>
              <button
                onClick={() => { flowSend("CREATE_INVOICE"); setShowNew(true); }}
                className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.97]"
              >
                <Plus className="w-4 h-4" /> Create your first invoice
              </button>
            </div>
          </div>

          {/* Ghost preview cards (visual hint of what's coming) */}
          <div className="mt-3 mx-5 flex flex-col gap-2.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="bg-card border border-dashed border-border rounded-2xl p-4 opacity-60"
                aria-hidden
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-3.5 w-32 bg-muted rounded-md" />
                    <div className="h-3 w-48 bg-muted rounded-md" />
                  </div>
                  <div className="h-4 w-16 bg-muted rounded-md ml-3" />
                </div>
              </div>
            ))}
          </div>

          {/* What ChaseHQ does */}
          <div className="mt-4 mx-5 bg-card border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">What happens next</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                "Drafts every follow-up in your tone — no blank screens.",
                "Sends them on the schedule you set in Settings.",
                "Pauses automatically when a client replies.",
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
        </>
      ) : (
        <>
          {/* Chase Feed */}
          {chaseFeed.length > 0 && (
            <div className="mt-5 mx-5 bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Chase Feed</h2>
                  <p className="text-xs text-muted-foreground">Prioritised actions</p>
                </div>
                <button onClick={() => navigate("/invoices")} className="text-sm font-medium text-primary">View all</button>
              </div>
              {chaseFeed.map((inv, i) => (
                <button
                  key={inv.id}
                  onClick={() => navigate(`/invoice/${inv.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${i < chaseFeed.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG[inv.status]?.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{inv.client}</span>
                      <span className="text-xs text-muted-foreground">{inv.id}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {inv.daysPastDue > 0 ? `${inv.daysPastDue} days overdue` : inv.description}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground shrink-0">{formatUSD(inv.amount)}</span>
                </button>
              ))}
            </div>
          )}

        </>
      )}

      <NewInvoiceModal visible={showNew} onClose={() => setShowNew(false)} onCreated={refetch} />
    </div>
  );
}
