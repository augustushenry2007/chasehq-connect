import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { createInvoice } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { withAuthRetry } from "@/flow/withAuthRetry";
import { savePending } from "@/lib/localInvoice";
import { createScheduleForInvoice } from "@/hooks/useNotifications";
import { X, CalendarIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parse, isValid } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { newInvoiceSchema } from "@/lib/validation";
import { differenceInDays, parseISO } from "date-fns";
import { getStartingTone } from "@/lib/scheduleDefaults";

function toAsciiDigits(s: string): string {
  return s.replace(/[०-९০-৯٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0966 && code <= 0x096F) return String(code - 0x0966);
    if (code >= 0x09E6 && code <= 0x09EF) return String(code - 0x09E6);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  }).replace(/[^0-9.]/g, "");
}

function formatDateMask(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  return parts.join("/");
}

function maskedToISO(masked: string): string {
  const parsed = parse(masked, "MM/dd/yyyy", new Date());
  if (!isValid(parsed)) return "";
  return format(parsed, "yyyy-MM-dd");
}

// Module-level draft cache so form survives unmount/remount during navigation hiccups.
interface Draft {
  client: string; email: string; description: string; amount: string; dueDateMasked: string; invoiceId: string;
}
const EMPTY_DRAFT: Draft = { client: "", email: "", description: "", amount: "", dueDateMasked: "", invoiceId: "" };
let draftCache: Draft = { ...EMPTY_DRAFT };

export default function NewInvoiceModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (invoiceId?: string) => void;
}) {
  const { user, isAuthenticated } = useApp();
  const [client, setClient] = useState(draftCache.client);
  const [email, setEmail] = useState(draftCache.email);
  const [description, setDescription] = useState(draftCache.description);
  const [amount, setAmount] = useState(draftCache.amount);
  const [dueDateMasked, setDueDateMasked] = useState(draftCache.dueDateMasked);
  const [invoiceIdInput, setInvoiceIdInput] = useState(draftCache.invoiceId);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mirror local state into the module-level cache so it persists across remounts.
  useEffect(() => {
    draftCache = { client, email, description, amount, dueDateMasked, invoiceId: invoiceIdInput };
  }, [client, email, description, amount, dueDateMasked, invoiceIdInput]);

  if (!visible) return null;

  const dueDateISO = maskedToISO(dueDateMasked);
  const dueDateValid = dueDateMasked === "" || dueDateISO !== "";
  const canSubmit = client && amount && dueDateISO && !creating;

  // For back-dated invoices, preview what the chase schedule will actually do.
  // Uses the same primitive the schedule generator uses, so what we show here
  // is what the user will see on ChaseSchedule after Save.
  let backDatedPreview: { daysOverdue: number; firstTone: string } | null = null;
  if (dueDateISO) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysOverdue = Math.max(0, differenceInDays(today, parseISO(dueDateISO)));
    if (daysOverdue > 0) {
      backDatedPreview = { daysOverdue, firstTone: getStartingTone(dueDateISO) };
    }
  }

  async function resolveUserId(): Promise<string | null> {
    if (user?.id) return user.id;
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id) return sessionData.session.user.id;
    const { data: refreshed } = await supabase.auth.refreshSession();
    return refreshed.session?.user?.id ?? null;
  }

  function resetDraft() {
    draftCache = { ...EMPTY_DRAFT };
    setClient(""); setEmail(""); setDescription(""); setAmount(""); setDueDateMasked(""); setInvoiceIdInput("");
  }

  async function handleCreate() {
    if (creating) return; // double-submit guard
    setErrorMsg(null);

    // zod-validate before doing anything (prevents bad data hitting DB / email).
    const parsed = newInvoiceSchema.safeParse({
      client,
      clientEmail: email,
      description,
      amount: parseFloat(amount),
      dueDate: dueDateISO,
    });
    if (!parsed.success) {
      const first = parsed.error.errors[0]?.message || "A few details need another look before we save this.";
      setErrorMsg(first);
      return;
    }
    const v = parsed.data;

    setCreating(true);
    try {
      // Guest path: persist locally and let the parent advance the flow.
      if (!isAuthenticated) {
        savePending({
          client: v.client,
          clientEmail: v.clientEmail,
          description: v.description,
          amount: v.amount,
          dueDate: v.dueDate,
        });
        resetDraft();
        setErrorMsg(null);
        onCreated();
        onClose();
        return;
      }

      const result = await withAuthRetry(async () => {
        const uid = await resolveUserId();
        if (!uid) throw new Error("auth/no-user-id");
        return await createInvoice(uid, {
          client: v.client,
          clientEmail: v.clientEmail,
          description: v.description,
          amount: v.amount,
          dueDate: v.dueDate,
          invoiceNumber: invoiceIdInput.trim() || undefined,
        });
      });

      if (result.invoice) {
        // Best-effort: create the default follow-up schedule + pending notifications
        await createScheduleForInvoice(result.invoice.user_id, {
          id: result.invoice.id,
          client: result.invoice.client,
          amount: Number(result.invoice.amount),
          due_date: result.invoice.due_date,
          created_at: result.invoice.created_at,
        });
        resetDraft();
        setErrorMsg(null);
        onCreated(result.invoice.invoice_number);
        onClose();
      } else if (result.error) {
        // Generic, friendly error — never surface auth internals to authed users.
        setErrorMsg("We couldn't save that invoice. Try once more.");
      }
    } catch {
      setErrorMsg("We couldn't save that invoice. Try once more.");
      toast.error("We couldn't save that invoice. Try once more.");
    } finally {
      setCreating(false);
    }
  }

  const textFields = [
    { label: "Client name *", value: client, onChange: setClient, placeholder: "Apex Digital", type: "text" },
    { label: "Client email", value: email, onChange: setEmail, placeholder: "billing@client.com", type: "email" },
    { label: "Description", value: description, onChange: setDescription, placeholder: "Brand identity & logo system", type: "text" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" onClick={onClose}>
      <div className="bg-background w-full max-w-lg rounded-2xl p-5 my-auto max-h-[90vh] overflow-auto shadow-xl animate-page-enter" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">New Invoice</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          {textFields.map((f) => (
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

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Invoice ID <span className="text-muted-foreground/70 font-normal">(optional)</span>
            </label>
            <input
              value={invoiceIdInput}
              onChange={(e) => setInvoiceIdInput(e.target.value.slice(0, 40))}
              placeholder="Leave blank to auto-generate (e.g. INV-001)"
              type="text"
              autoComplete="off"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Used in your follow-up emails. Leave blank and we'll number it for you.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount ($) *</label>
            <input
              value={amount}
              onChange={(e) => setAmount(toAsciiDigits(e.target.value))}
              placeholder="4800"
              type="text"
              inputMode="decimal"
              pattern="[0-9.]*"
              autoComplete="off"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Due date * (MM/DD/YYYY)</label>
            <div className="relative">
              <input
                value={dueDateMasked}
                onChange={(e) => setDueDateMasked(formatDateMask(e.target.value))}
                onFocus={() => setCalendarOpen(true)}
                onClick={() => setCalendarOpen(true)}
                placeholder="MM/DD/YYYY"
                inputMode="numeric"
                className={cn(
                  "w-full px-3.5 py-2.5 pr-11 rounded-xl border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 cursor-pointer",
                  dueDateValid ? "border-border focus:ring-primary/30" : "border-destructive/60 focus:ring-destructive/30"
                )}
              />
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open calendar"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={dueDateISO ? new Date(dueDateISO + "T00:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setDueDateMasked(format(d, "MM/dd/yyyy"));
                        setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {!dueDateValid && (
              <p className="text-[11px] text-destructive mt-1">Use MM/DD/YYYY so we know when this was due.</p>
            )}
            {backDatedPreview && (
              <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  This invoice is {backDatedPreview.daysOverdue} {backDatedPreview.daysOverdue === 1 ? "day" : "days"} overdue.
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                  ChaseHQ will start chasing today, beginning with a {backDatedPreview.firstTone} tone. You can edit the schedule on the next screen.
                </p>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[12px] text-destructive">{errorMsg}</p>
                <button
                  onClick={handleCreate}
                  className="mt-1 text-[12px] font-semibold text-destructive underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="mt-2 w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all duration-200 ease-out active:scale-[0.97]"
          >
            {creating ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
