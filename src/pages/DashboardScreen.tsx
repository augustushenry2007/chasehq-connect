import { useNavigate } from "react-router-dom";
import { useInvoices } from "@/hooks/useSupabaseData";
import { ACTIVITY, getStats, getChaseFeed, formatUSD, type ActivityItem, type ActivityType } from "@/lib/data";
import { useApp } from "@/context/AppContext";
import { StatusBadge, STATUS_CONFIG } from "@/components/StatusBadge";
import { TrendingUp, AlertTriangle, CheckCircle, Mail, Eye, Clock, MessageSquare, Check } from "lucide-react";

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

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { invoices } = useInvoices();
  const stats = getStats(invoices);
  const chaseFeed = getChaseFeed(invoices);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="flex-1 overflow-auto pb-24">
      <div className="px-5 pt-5">
        <h1 className="text-xl font-bold text-foreground">Good morning, {firstName}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Here's what needs your attention today.</p>

        <div className="flex gap-3 mt-5">
          <StatCard label="Outstanding" value={formatUSD(stats.outstandingTotal)} sub={`${stats.outstandingCount} invoices`} icon={TrendingUp} iconColor="#3B82F6" />
          <StatCard label="Overdue" value={formatUSD(stats.overdueTotal)} sub={`${stats.overdueCount} need action`} icon={AlertTriangle} iconColor="#F59E0B" valueColor="#DC2626" />
        </div>
        <div className="mt-3">
          <StatCard label="Paid this Month" value={formatUSD(stats.paidTotal)} sub={`${stats.paidCount} invoices collected`} icon={CheckCircle} iconColor="#22C55E" valueColor="#16A34A" />
        </div>
      </div>

      {/* Chase Feed */}
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

      {/* Activity */}
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
    </div>
  );
}
