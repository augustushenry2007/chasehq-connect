import type { InvoiceStatus } from "@/lib/data";

export const STATUS_CONFIG: Record<InvoiceStatus, { bg: string; text: string; dot: string }> = {
  Escalated: { bg: "#FEE2E2", text: "#DC2626", dot: "#DC2626" },
  Overdue: { bg: "#FEF3C7", text: "#D97706", dot: "#F59E0B" },
  "Follow-up": { bg: "#DBEAFE", text: "#2563EB", dot: "#3B82F6" },
  Upcoming: { bg: "#DBEAFE", text: "#2563EB", dot: "#3B82F6" },
  Paid: { bg: "#DCFCE7", text: "#16A34A", dot: "#22C55E" },
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STATUS_CONFIG[status];
  const label = status === "Follow-up" ? "Upcoming" : status;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {label}
    </span>
  );
}
