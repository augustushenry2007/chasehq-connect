import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useInvoices } from "@/hooks/useSupabaseData";
import { formatUSD, type Invoice } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus, X, ChevronRight, FileText } from "lucide-react";
import NewInvoiceModal from "@/components/invoice/NewInvoiceModal";
import NotificationBell from "@/components/NotificationBell";
import { useFlow } from "@/flow/FlowMachine";
import { FlowState } from "@/flow/states";
import { useApp } from "@/context/AppContext";
import { startGoogleOAuth } from "@/lib/oauth";

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

export default function InvoicesScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [guestDraftCreated, setGuestDraftCreated] = useState(false);
  const invoiceCreatedRef = useRef(false);
  const { state: flowState, send } = useFlow();
  const { isAuthenticated } = useApp();

  const { invoices, loading, refetch } = useInvoices();
  const filtered = useMemo(() => getFiltered(invoices, activeTab, query), [invoices, activeTab, query]);
  const isEmptyWorkspace = invoices.length === 0;

  // Open the New Invoice modal whenever the flow says CREATE_INVOICE, OR via legacy ?new=1.
  useEffect(() => {
    if (flowState === FlowState.CREATE_INVOICE) {
      setShowNew(true);
    }
  }, [flowState]);

  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam && ["overdue", "upcoming", "paid", "all"].includes(filterParam)) {
      setActiveTab(filterParam as FilterTab);
    }
    if (searchParams.get("new") === "1") {
      setShowNew(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("filter");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreated() {
    invoiceCreatedRef.current = true;
    refetch();
    if (!isAuthenticated) {
      setGuestDraftCreated(true);
      send("INVOICE_CREATED");
    } else if (flowState === FlowState.CREATE_INVOICE) {
      send("INVOICE_CREATED");
    }
  }

  function handleCloseModal() {
    setShowNew(false);
    if (!invoiceCreatedRef.current && flowState === FlowState.CREATE_INVOICE) {
      send("BACK_TO_DASHBOARD");
    }
    invoiceCreatedRef.current = false;
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-6 w-32 bg-muted rounded-md animate-pulse" />
            <div className="h-3 w-56 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="h-9 w-20 bg-muted rounded-xl animate-pulse" />
        </div>
        <div className="mx-5 h-11 bg-card border border-border rounded-xl animate-pulse" />
        <div className="flex gap-2 mt-3 px-5 border-b border-border pb-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 w-16 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
        <div className="flex-1 overflow-hidden pb-24">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-5 py-3.5 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-muted rounded-md animate-pulse" />
                  <div className="h-3 w-56 bg-muted rounded-md animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded-md animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-muted rounded-md animate-pulse ml-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-page-enter">
      {!isAuthenticated && (
        <div className="mx-5 mt-4 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-4">
          <p className="text-sm font-bold text-foreground">
            {guestDraftCreated ? "Your draft is saved on this device" : "Finish setting up your account"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            {guestDraftCreated
              ? "Sign up to save it to your account and send this follow-up."
              : "Sign up to keep your invoices and start sending follow-ups."}
          </p>
          <button
            onClick={async () => {
              send("REQUEST_POST_INVOICE_AUTH");
              const { error } = await startGoogleOAuth(window.location.origin + "/auth-after-invoice");
              if (error) toast.error("Sign-in didn't go through. Give it another try.");
            }}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
          >
            Create free account
          </button>
        </div>
      )}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Follow-Ups</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Every follow-up, every client — in one place.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated && <NotificationBell />}
          {!isEmptyWorkspace && (
            <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-2 rounded-xl text-sm font-semibold">
              <Plus className="w-4 h-4" /> New
            </button>
          )}
        </div>
      </div>

      {!isEmptyWorkspace && (
        <>
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
        </>
      )}

      <div className="flex-1 overflow-auto pb-24">
        {isEmptyWorkspace ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground">Nothing on your plate yet.</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Add an invoice and ChaseHQ will draft the follow-ups for you — sent on your schedule.
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-5 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Add your first invoice
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">Nothing matches that.</p>
            <p className="text-sm text-muted-foreground mt-1">{query ? `Nothing matches "${query}".` : "Nothing here yet."}</p>
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

      <NewInvoiceModal visible={showNew} onClose={handleCloseModal} onCreated={handleCreated} />
    </div>
  );
}
