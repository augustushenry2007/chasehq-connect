import { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft, RefreshCw, Send, Loader2, AlertTriangle, Shuffle, Sparkles, CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useFlow } from "@/flow/FlowMachine";
import { savePending, markGuestOnboarded } from "@/lib/localInvoice";
import { startGoogleOAuth } from "@/lib/oauth";
import MockIAPSheet from "@/components/onboarding/MockIAPSheet";
import { GoogleIcon } from "@/components/GoogleIcon";
import { generateFollowup } from "@/hooks/useSupabaseData";
import { useActionGate } from "@/hooks/useActionGate";
import { getDefaultDraft, getTemplateDraft, TEMPLATE_COUNT, type Tone } from "@/components/invoice/DraftTemplates";
import type { Invoice } from "@/lib/data";
import { differenceInDays, format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TONES: Tone[] = ["Polite", "Friendly", "Firm", "Urgent", "Final Notice"];
const FIELDS_KEY = "guest_draft_fields_v1";

const CTA_BY_TONE: Record<Tone, string> = {
  "Polite":       "Send this gently",
  "Friendly":     "Send a warm nudge",
  "Firm":         "Send this clearly",
  "Urgent":       "Send — they need to know",
  "Final Notice": "Send final notice",
};

function buildGuestInvoice(client: string, amount: string, dueDateISO: string, clientEmail: string): Invoice {
  const amtNum = parseFloat(amount) || 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = dueDateISO ? new Date(dueDateISO + "T00:00:00") : today;
  const daysPastDue = Math.max(0, differenceInDays(today, due));
  const displayDate = dueDateISO
    ? new Date(dueDateISO + "T00:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    : "";
  const status = daysPastDue > 0 ? "Overdue" : "Upcoming";
  return {
    id: "INV-001",
    dbId: "",
    client: client.trim() || "Your Client",
    clientEmail,
    description: "",
    amount: amtNum,
    dueDate: displayDate,
    dueDateISO,
    status,
    daysPastDue,
    sentFrom: "you@example.com",
    paymentDetails: "",
  };
}

function loadSavedFields(): { client: string; amount: string; dueDate: string; clientEmail: string } {
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    if (!raw) return { client: "", amount: "", dueDate: "", clientEmail: "" };
    const parsed = JSON.parse(raw);
    return { client: parsed.client || "", amount: parsed.amount || "", dueDate: parsed.dueDate || "", clientEmail: parsed.clientEmail || "" };
  } catch {
    return { client: "", amount: "", dueDate: "", clientEmail: "" };
  }
}

function saveFields(client: string, amount: string, dueDate: string, clientEmail: string) {
  try {
    localStorage.setItem(FIELDS_KEY, JSON.stringify({ client, amount, dueDate, clientEmail }));
  } catch { /* ignore */ }
}

export default function GuestDraftScreen() {
  const { send } = useFlow();
  const gate = useActionGate();

  const saved = loadSavedFields();
  const [client, setClient] = useState(saved.client);
  const [clientEmail, setClientEmail] = useState(saved.clientEmail);
  const [amount, setAmount] = useState(saved.amount);
  const [dueDate, setDueDate] = useState(saved.dueDate); // ISO yyyy-MM-dd
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [iapSheetOpen, setIapSheetOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [tone, setTone] = useState<Tone>("Friendly");
  const [currentSubject, setCurrentSubject] = useState("");
  const [currentDraft, setCurrentDraft] = useState("");
  const [templateIndex, setTemplateIndex] = useState(0);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(false);
  const [sending, setSending] = useState(false);

  const clientRef = useRef<HTMLInputElement>(null);
  const clientEmailRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLButtonElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);

  const fieldsComplete = client.trim() !== "" && amount.trim() !== "" && dueDate !== "";
  // Memoize invoice so it's stable for the draft effect below
  const invoice = useMemo(
    () => buildGuestInvoice(client, amount, dueDate, clientEmail),
    [client, amount, dueDate, clientEmail],
  );

  // Persist fields on change
  useEffect(() => {
    saveFields(client, amount, dueDate, clientEmail);
  }, [client, amount, dueDate, clientEmail]);

  // Regenerate template draft when tone or invoice fields change (only when complete)
  // Run synchronously-ish via useMemo to avoid the one-render flash of empty draft
  const defaultDraft = useMemo(() => {
    if (!fieldsComplete) return null;
    return getDefaultDraft(invoice, tone);
  }, [tone, fieldsComplete, invoice]);

  const prevDefaultRef = useRef<typeof defaultDraft>(null);
  useEffect(() => {
    if (!defaultDraft) return;
    if (defaultDraft === prevDefaultRef.current) return;
    prevDefaultRef.current = defaultDraft;
    // Only auto-update if user hasn't manually edited or AI-generated
    if (!isAiGenerated) {
      setCurrentSubject(defaultDraft.subject);
      setCurrentDraft(defaultDraft.message);
      setGenerationError(false);
      setTemplateIndex(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDraft]);

  function handleCycleTemplate() {
    if (!fieldsComplete) return;
    const nextIndex = (templateIndex + 1) % TEMPLATE_COUNT;
    setTemplateIndex(nextIndex);
    const t = getTemplateDraft(invoice, tone, nextIndex);
    setCurrentSubject(t.subject);
    setCurrentDraft(t.message);
    setIsAiGenerated(false);
    setGenerationError(false);
  }

  async function handleGenerate() {
    if (!fieldsComplete || isGenerating) return;
    if (!gate.canExecute) {
      savePending({
        client: client.trim(),
        clientEmail: clientEmail.trim(),
        description: "",
        amount: parseFloat(amount) || 0,
        dueDate,
      });
      markGuestOnboarded();
      try { localStorage.setItem("pending_draft_tone_v1", tone); } catch {}
      setIapSheetOpen(true);
      return;
    }
    setIsGenerating(true);
    setGenerationError(false);
    try {
      const result = await generateFollowup(invoice, tone, isAiGenerated ? currentDraft : undefined);
      if (result) {
        setCurrentDraft(result.message);
        setCurrentSubject(result.subject);
        setIsAiGenerated(true);
        setGenerationError(false);
        setTimeout(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      } else {
        // Fall back to next template variant rather than showing an error state
        const nextIndex = (templateIndex + 1) % TEMPLATE_COUNT;
        const t = getTemplateDraft(invoice, tone, nextIndex);
        setCurrentSubject(t.subject);
        setCurrentDraft(t.message);
        setTemplateIndex(nextIndex);
        setGenerationError(true);
      }
    } catch {
      setGenerationError(true);
    }
    setIsGenerating(false);
  }

  function handleSend() {
    if (sending) return;
    if (!client.trim()) {
      clientRef.current?.focus();
      clientRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Add your client's name to get started.");
      return;
    }
    if (!clientEmail.trim()) {
      clientEmailRef.current?.focus();
      clientEmailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("We'll need your client's email to send this.");
      return;
    }
    if (!amount.trim()) {
      amountRef.current?.focus();
      amountRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Add the amount owed.");
      return;
    }
    if (!dueDate) {
      dueDateRef.current?.focus();
      dueDateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Add a due date so we can time the follow-ups.");
      return;
    }

    savePending({
      client: client.trim(),
      clientEmail: clientEmail.trim(),
      description: "",
      amount: parseFloat(amount) || 0,
      dueDate,
    });
    markGuestOnboarded();
    try { localStorage.setItem("pending_draft_tone_v1", tone); } catch {}
    setIapSheetOpen(true);
  }

  async function handleGoogleSignUp() {
    if (googleLoading) return;
    setGoogleLoading(true);
    send("REQUEST_AUTH");
    const { error } = await startGoogleOAuth(window.location.origin + "/auth-after-invoice");
    if (error) {
      toast.error("Sign-in didn't go through. Give it another try.");
      setGoogleLoading(false);
    }
  }

  const isFinalNotice = tone === "Final Notice";

  return (
    <div className="h-screen flex flex-col bg-background animate-page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,16px)] pb-4 border-b border-border shrink-0">
        <button
          onClick={() => send("BACK_TO_DASHBOARD")}
          className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-foreground">Your Follow-Up Draft</h1>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div className="px-5 pt-5 space-y-4 max-w-lg mx-auto pb-12">

        {/* Section 1 — Invoice capture */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Who owes you, and how much?</h2>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client name *</label>
              <input
                ref={clientRef}
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Apex Digital"
                className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client email *</label>
              <input
                ref={clientEmailRef}
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                type="email"
                inputMode="email"
                className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Amount owed ($) *</label>
                <input
                  ref={amountRef}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="4800"
                  type="number"
                  min="0"
                  className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Due date *</label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      ref={dueDateRef}
                      type="button"
                      className="w-full flex items-center justify-between gap-2 bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <span className={dueDate ? "text-foreground" : "text-muted-foreground"}>
                        {dueDate ? format(new Date(dueDate + "T00:00:00"), "MM/dd/yyyy") : "Pick a date"}
                      </span>
                      <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          setDueDate(`${y}-${m}-${day}`);
                          setCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 — Draft */}
        <div
          ref={draftRef}
          className={`bg-card border border-border rounded-2xl p-4 transition-opacity duration-300 ${fieldsComplete ? "opacity-100" : "opacity-50 pointer-events-none select-none"}`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">AI Follow-up Draft</h3>
            {isAiGenerated && (
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI Generated</span>
            )}
          </div>

          {!fieldsComplete && (
            <p className="text-xs text-muted-foreground py-4 text-center">Fill in the details above to see your draft.</p>
          )}

          {fieldsComplete && (
            <>
              {/* Tone selector */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {TONES.map((t) => {
                  const isFinal = t === "Final Notice";
                  const selected = tone === t;
                  let cls: string;
                  if (selected && isFinal) {
                    cls = "bg-amber-500 text-white border-amber-600 shadow-sm";
                  } else if (selected) {
                    cls = "bg-primary text-primary-foreground border-primary shadow-sm";
                  } else if (isFinal) {
                    cls = "bg-background text-amber-700 dark:text-amber-500 border-amber-300 dark:border-amber-700/50 hover:bg-amber-50 dark:hover:bg-amber-950/30";
                  } else {
                    cls = "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground";
                  }
                  return (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${cls}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              {isFinalNotice && (
                <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    This is a <strong>final escalation notice</strong>. Review carefully before sending.
                  </p>
                </div>
              )}

              {/* Subject */}
              <div className="mb-2">
                <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                <input
                  value={currentSubject}
                  onChange={(e) => setCurrentSubject(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Message body */}
              {isGenerating ? (
                <div className="space-y-2 py-3">
                  <div className="h-3.5 bg-muted rounded-md animate-pulse w-full" />
                  <div className="h-3.5 bg-muted rounded-md animate-pulse w-5/6" />
                  <div className="h-3.5 bg-muted rounded-md animate-pulse w-full" />
                  <div className="h-3.5 bg-muted rounded-md animate-pulse w-3/4" />
                  <div className="h-3.5 bg-muted rounded-md animate-pulse w-full" />
                  <div className="h-3.5 bg-muted rounded-md animate-pulse w-5/6" />
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating {tone.toLowerCase()} follow-up…
                  </div>
                </div>
              ) : (
                <>
                  {generationError && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-200">AI unavailable — showing a template draft instead.</p>
                    </div>
                  )}
                  <textarea
                    value={currentDraft}
                    onChange={(e) => setCurrentDraft(e.target.value)}
                    rows={10}
                    className="w-full bg-muted border border-border rounded-xl px-3.5 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
                  />
                </>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex gap-2">
                  <button
                    onClick={handleCycleTemplate}
                    disabled={isGenerating}
                    title={`Template ${(templateIndex % TEMPLATE_COUNT) + 1} of ${TEMPLATE_COUNT}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border bg-muted/50 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Template {(templateIndex % TEMPLATE_COUNT) + 1}/{TEMPLATE_COUNT}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                    {isAiGenerated ? "Regenerate" : "Generate with AI"}
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-50 ${
                    isFinalNotice
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="w-4 h-4" /> {CTA_BY_TONE[tone]}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
      </div>

      <MockIAPSheet
        open={iapSheetOpen}
        onConfirm={() => { setIapSheetOpen(false); setAuthDialogOpen(true); }}
        onCancel={() => { setIapSheetOpen(false); setSending(false); }}
      />

      {authDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
          onClick={() => !googleLoading && setAuthDialogOpen(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl shadow-2xl p-6 pb-[max(env(safe-area-inset-bottom,16px),24px)] animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-border mb-5" />
            <h2 className="text-lg font-bold text-foreground mb-1">Save your draft &amp; start trial</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Create your account to start your 14-day free trial. Your draft will be waiting in the dashboard.
            </p>
            <button
              onClick={handleGoogleSignUp}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3.5 disabled:opacity-60 transition-all duration-200 ease-out active:scale-[0.97]"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-foreground" />
              ) : (
                <>
                  <GoogleIcon className="w-5 h-5" />
                  <span className="text-sm font-medium text-foreground">Continue with Google</span>
                </>
              )}
            </button>
            <button
              onClick={() => setAuthDialogOpen(false)}
              disabled={googleLoading}
              className="mt-3 w-full py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
