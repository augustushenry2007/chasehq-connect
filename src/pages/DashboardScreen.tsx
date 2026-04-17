import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices } from "@/hooks/useSupabaseData";
import { ACTIVITY, getStats, getChaseFeed, formatUSD } from "@/lib/data";
import { useApp } from "@/context/AppContext";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { StatusBadge, STATUS_CONFIG } from "@/components/StatusBadge";
import {
  TrendingUp, AlertTriangle, CheckCircle, Mail, Eye, Clock, MessageSquare, Check,
  Plus, FileText, Sparkles, ArrowRight, Loader2,
} from "lucide-react";
import NewInvoiceModal from "@/components/invoice/NewInvoiceModal";
import { toast } from "sonner";
import type { ActivityType } from "@/lib/data";

const ACTIVITY_ICON: Record<ActivityType, { bg: string; icon: React.ElementType; color: string }> = {
  payment: { bg: "#DCFCE7", icon: Check, color: "#16A34A" },
  reminder: { bg: "#DBEAFE", icon: Mail, color: "#2563EB" },
  escalation: { bg: "#FEE2E2", icon: AlertTriangle, color: "#DC2626" },
  view: { bg: "#F3E8FF", icon: Eye, color: "#7C3AED" },
  overdue: { bg: "#FEF3C7", icon: Clock, color: "#D97706" },
  reply: { bg: "#DBEAFE", icon: MessageSquare, color: "#2563EB" },
};

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

function GetStartedStep({
  done, title, description, action, onAction, loading, icon: Icon,
}: {
  done: boolean; title: string; description: string; action: string; onAction: () => void; loading?: boolean; icon: React.ElementType;
}) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${done ? "bg-accent/40 border-accent" : "bg-card border-border"}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${done ? "bg-primary" : "bg-accent"}`}>
        {done ? <Check className="w-4 h-4 text-primary-foreground" /> : <Icon className="w-4 h-4 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {!done && (
          <button
            onClick={onAction}
            disabled={loading}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <>{action} <ArrowRight className="w-3 h-3" /></>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { invoices, refetch } = useInvoices();
  const { gmail, connectGmail } = useGmailConnection();
  const [showNew, setShowNew] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);

  const stats = getStats(invoices);
  const chaseFeed = getChaseFeed(invoices);
  const isEmpty = invoices.length === 0;

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  async function handleConnectGmail() {
    setConnectingGmail(true);
    const result = await connectGmail();
    if (result.error) {
      toast.error(result.error);
      setConnectingGmail(false);
    }
    // On success, browser redirects to Google
  }

  return (
    <div className="flex-1 overflow-auto pb-24">
      <div className="px-5 pt-5">
        <h1 className="text-xl font-bold text-foreground">
          {isEmpty ? `Welcome, ${firstName}` : `Good morning, ${firstName}`}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isEmpty ? "Let's get you set up so ChaseHQ can chase invoices for you." : "Here's what needs your attention today."}
        </p>

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
          {/* Hero CTA */}
          <div className="mt-5 mx-5 bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-accent/60" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Add your first invoice</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Tell us who owes you and how much. We'll handle the awkward part — drafting and sending the follow-ups for you.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                <Plus className="w-4 h-4" /> Create invoice
              </button>
            </div>
          </div>

          {/* Get-started checklist */}
          <div className="mt-4 mx-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Get set up
            </h3>
            <div className="flex flex-col gap-2.5">
              <GetStartedStep
                done={!isEmpty}
                title="Add your first invoice"
                description="Track what clients owe and watch ChaseHQ chase for you."
                action="Add invoice"
                onAction={() => setShowNew(true)}
                icon={FileText}
              />
              <GetStartedStep
                done={gmail.connected}
                title="Connect your inbox"
                description={gmail.connected ? `Connected as ${gmail.email}` : "Send follow-ups from your own Gmail so replies land where you'd expect."}
                action="Connect Gmail"
                onAction={handleConnectGmail}
                loading={connectingGmail}
                icon={Mail}
              />
            </div>
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

          {/* Recent Activity (only when there is real activity) */}
          {ACTIVITY.length > 0 && (
            <div className="mt-4 mx-5 bg-card border border-border rounded-2xl overflow-hidden mb-4">
              <div className="px-4 pt-4 pb-2">
                <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
                <p className="text-xs text-muted-foreground">Latest updates</p>
              </div>
              {ACTIVITY.map((item, i) => {
                const cfg = ACTIVITY_ICON[item.type];
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/invoice/${item.invoiceId}`)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${i < ACTIVITY.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.bg }}>
                      <cfg.icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.client} · {item.timeAgo}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <NewInvoiceModal visible={showNew} onClose={() => setShowNew(false)} onCreated={refetch} />
    </div>
  );
}
