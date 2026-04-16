import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices, createInvoice } from "@/hooks/useSupabaseData";
import { formatUSD, type Invoice, type InvoiceStatus } from "@/lib/data";
import { useApp } from "@/context/AppContext";
import { StatusBadge, STATUS_CONFIG } from "@/components/StatusBadge";
import { Search, Plus, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type FilterTab = "all" | "overdue" | "upcoming" | "paid";

function getFiltered(invoices: Invoice[], tab: FilterTab, query: string) {
  let list = invoices;
  if (tab === "overdue") list = list.filter((i) => i.status === "Escalated" || i.status === "Overdue" || i.status === "Follow-up");
  else if (tab === "upcoming") list = list.filter((i) => i.status === "Upcoming");
  else if (tab === "paid") list = list.filter((i) => i.status === "Paid");
  if (query.trim()) {
    const q = query.toLowerCase();
    list = list.filter((i) => i.id.toLowerCase().includes(q) || i.client.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }
  return list;
}

function getTabCount(invoices: Invoice[], tab: FilterTab) {
  if (tab === "all") return invoices.length;
  if (tab === "overdue") return invoices.filter((i) => ["Escalated", "Overdue", "Follow-up"].includes(i.status)).length;
  if (tab === "upcoming") return invoices.filter((i) => i.status === "Upcoming").length;
  if (tab === "paid") return invoices.filter((i) => i.status === "Paid").length;
  return 0;
}

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "paid", label: "Paid" },
];

function NewInvoiceModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { user } = useApp();
  const [client, setClient] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  if (!visible) return null;

  async function handleCreate() {
    if (!user) { toast.error("Not signed in"); return; }
    if (!client || !amount || !dueDate) { toast.error("Fill in required fields"); return; }
    setCreating(true);
    const result = await createInvoice(user.id, {
      client,
      clientEmail: email,
      description,
      amount: parseFloat(amount),
      dueDate,
    });
    setCreating(false);
    if (result) {
      setClient(""); setEmail(""); setDescription(""); setAmount(""); setDueDate("");
      onCreated();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
      <div className="bg-background w-full max-w-lg rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">New Invoice</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          {[
            { label: "Client name *", value: client, onChange: setClient, placeholder: "Apex Digital", type: "text" },
            { label: "Client email", value: email, onChange: setEmail, placeholder: "billing@client.com", type: "email" },
            { label: "Description", value: description, onChange: setDescription, placeholder: "Brand identity & logo system", type: "text" },
            { label: "Amount ($) *", value: amount, onChange: setAmount, placeholder: "4800", type: "number" },
            { label: "Due date *", value: dueDate, onChange: setDueDate, placeholder: "2024-06-15", type: "date" },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
              <input
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                type={f.type}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
          <button
            onClick={handleCreate}
            disabled={!client || !amount || !dueDate || creating}
            className="mt-2 w-full bg-foreground text-background py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);

  const { invoices, refetch } = useInvoices();
  const filtered = useMemo(() => getFiltered(invoices, activeTab, query), [invoices, activeTab, query]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Invoices</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage and track all your client invoices</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 bg-foreground text-background px-3.5 py-2 rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      <div className="mx-5 flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search invoices..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {query && <button onClick={() => setQuery("")}><X className="w-4 h-4 text-muted-foreground" /></button>}
      </div>

      <div className="flex border-b border-border mt-3 px-5 gap-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = getTabCount(invoices, tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 pb-2.5 pt-1 border-b-2 transition-colors ${isActive ? "border-primary" : "border-transparent"}`}
            >
              <span className={`text-sm ${isActive ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto pb-24">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">No invoices found</p>
            <p className="text-sm text-muted-foreground mt-1">{query ? `No results for "${query}"` : "No invoices in this category"}</p>
          </div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/invoice/${item.id}`)}
              className="w-full flex items-center px-5 py-3.5 border-b border-border text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{item.client}</span>
                  <span className="text-xs text-muted-foreground">{item.id}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusBadge status={item.status} />
                  <span className="text-xs text-muted-foreground">{item.dueDate}</span>
                  {item.daysPastDue > 0 && (
                    <span className="text-xs font-semibold text-destructive">+{item.daysPastDue}d</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-sm font-semibold text-foreground">{formatUSD(item.amount)}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>

      <NewInvoiceModal visible={showNew} onClose={() => setShowNew(false)} onCreated={refetch} />
    </div>
  );
}
