import { useState, useRef, useEffect } from "react";
import { RefreshCw, Send, Loader2, AlertTriangle, Lock, Check, CheckCircle, Shuffle } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/data";
import { generateFollowup, sendFollowupEmail, recordFollowup, validateAppleReceipt } from "@/hooks/useSupabaseData";
import { advanceScheduleAfterSend } from "@/hooks/useNotifications";
import { getDefaultDraft, getTemplateDraft, TEMPLATE_COUNT, type Tone } from "./DraftTemplates";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useActionGate } from "@/hooks/useActionGate";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { startGoogleOAuth } from "@/lib/oauth";
import MockIAPSheet from "@/components/onboarding/MockIAPSheet";
import { GoogleIcon } from "@/components/GoogleIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TONES: Tone[] = ["Polite", "Friendly", "Firm", "Urgent", "Final Notice"];

const SEND_CONFIRM_BODY: Record<string, string> = {
  "Polite":   "A courteous nudge on its way to {client}. Polite, clear, and easy to act on.",
  "Friendly": "A warm reminder headed to {client}. Friendly enough to keep the relationship, clear enough to get paid.",
  "Firm":     "A direct message on its way to {client}. No ambiguity — they'll know payment is expected now.",
  "Urgent":   "{client} will receive this shortly. It's firm, but fair — and it's time they knew.",
};

function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export default function AIDraftComposer({ invoice, onSent }: { invoice: Invoice; onSent?: () => void }) {
  const { user, notifications, isAuthenticated, fullName } = useApp();
  const { canSend, loading: entLoading, trialEndsAt, refetch: refetchEntitlement, isTrialing, isActive, isPastDue } = useEntitlement();
  const gate = useActionGate();
  const [tone, setTone] = useState<Tone>(notifications.defaultTone as Tone);
  const [currentSubject, setCurrentSubject] = useState("");
  const [currentDraft, setCurrentDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [confirmFinalOpen, setConfirmFinalOpen] = useState(false);
  const [confirmRecentSendOpen, setConfirmRecentSendOpen] = useState(false);
  const [pendingTone, setPendingTone] = useState<Tone | null>(null);
  const [iapSheetOpen, setIapSheetOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  useEffect(() => {
    supabase
      .from("followups")
      .select("sent_at")
      .eq("invoice_id", invoice.dbId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.sent_at) setLastSentAt(new Date(data.sent_at));
      });
  }, [invoice.dbId]);
  const [authPaywallOpen, setAuthPaywallOpen] = useState(false);
  const [paywallPhase, setPaywallPhase] = useState<"idle" | "confirming" | "success">("idle");
  const paywallIntentRef = useRef<"send" | "generate">("send");
  const draftRef = useRef<HTMLDivElement>(null);
  const userEditedRef = useRef(false);

  const isFinalNotice = tone === "Final Notice";
  const locked = !entLoading && !canSend;
  const msSinceLastSend = lastSentAt ? Date.now() - lastSentAt.getTime() : null;
  const recentlySent = msSinceLastSend !== null && msSinceLastSend < 24 * 3_600_000;

  // Load template when tone changes (resets AI flag and discards manual edits)
  useEffect(() => {
    if (isGenerating) return;
    const def = getDefaultDraft(invoice, tone, fullName || undefined);
    setCurrentSubject(def.subject);
    setCurrentDraft(def.message);
    setIsAiGenerated(false);
    setGenerationError(false);
    setTemplateIndex(0);
    userEditedRef.current = false;
  }, [tone, invoice]);

  function handleCycleTemplate() {
    const nextIndex = (templateIndex + 1) % TEMPLATE_COUNT;
    setTemplateIndex(nextIndex);
    const t = getTemplateDraft(invoice, tone, nextIndex, fullName || undefined);
    setCurrentSubject(t.subject);
    setCurrentDraft(t.message);
    setIsAiGenerated(false);
    setGenerationError(false);
    userEditedRef.current = false;
  }

  async function handleGenerate() {
    if (isGenerating) return; // dedupe rapid clicks
    setIsGenerating(true);
    setGenerationError(false);
    const displayName = fullName?.trim() ? fullName.trim().replace(/\b\w/g, c => c.toUpperCase()) : undefined;
    const result = await generateFollowup(invoice, tone, isAiGenerated ? currentDraft : undefined, displayName);
    if (result) {
      if (result.message === currentDraft) {
        toast.message("That one came out similar. Regenerate or switch tones for a different feel.");
      }
      setCurrentDraft(result.message);
      setCurrentSubject(result.subject);
      setIsAiGenerated(true);
      setGenerationError(false);
      userEditedRef.current = false;
    } else {
      setGenerationError(true);
    }
    setIsGenerating(false);
    setTimeout(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }

  function handleToneChange(t: Tone) {
    if (t === tone) return;
    if (userEditedRef.current || isAiGenerated) {
      setPendingTone(t);
    } else {
      setTone(t);
    }
  }

  async function doSend() {
    if (sending) return;
    if (!currentDraft || !currentSubject) {
      toast.error("Add a subject and message before sending.");
      return;
    }
    if (!invoice.clientEmail) {
      toast.error("Add your client's email so we can send this for you.");
      return;
    }
    setSending(true);

    const result = await sendFollowupEmail(invoice.clientEmail, currentSubject, currentDraft, invoice.dbId);

    if (result.ok === false) {
      setSending(false);
      if (result.reason === "subscription_required") {
        setAuthPaywallOpen(true);
        return;
      }
      if (result.reason === "no_mailbox") {
        toast.error("Connect your Gmail in Settings and we'll send this for you.");
        return;
      }
      if (result.reason === "rate_limited") {
        toast.error(result.message || "You've hit today's send limit. We'll be ready again tomorrow.");
        return;
      }
      toast.error(result.message || "We couldn't send this one. Your draft is safe — give it another try.");
      return;
    }

    // Persist follow-up history so the timeline reflects reality.
    if (user?.id) {
      await recordFollowup(user.id, invoice.dbId, {
        subject: currentSubject,
        message: currentDraft,
        tone,
        isAiGenerated,
      });
    }
    // Cancel the next pending reminder for this invoice.
    await advanceScheduleAfterSend(invoice.dbId);

    setSending(false);
    setSent(true);
    setLastSentAt(new Date());
    onSent?.();
    setTimeout(() => setSent(false), 3000);
  }

  function openGatePanel(intent: "send" | "generate") {
    paywallIntentRef.current = intent;
    if (gate.panelVariant === "guest") setIapSheetOpen(true);
    else setAuthPaywallOpen(true);
  }

  function handleSendClick() {
    if (!gate.canExecute) { openGatePanel("send"); return; }
    if (isFinalNotice) { setConfirmFinalOpen(true); return; }
    if (recentlySent) { setConfirmRecentSendOpen(true); return; }
    setConfirmSendOpen(true);
  }

  function handleConfirmSend() {
    setConfirmSendOpen(false);
    doSend();
  }

  async function handleGoogleSignUp() {
    if (googleLoading) return;
    setGoogleLoading(true);
    const { error } = await startGoogleOAuth(window.location.origin + "/auth-after-invoice");
    if (error) {
      toast.error("Sign-in didn't go through. Give it another try.");
      setGoogleLoading(false);
    }
  }

  async function handlePaywall() {
    if (paywallPhase !== "idle") return;
    setPaywallPhase("confirming");
    try {
      const { purchaseSubscription } = await import("@/lib/iap");
      const iap = await purchaseSubscription();
      if (!iap.ok) {
        setPaywallPhase("idle");
        if (!iap.canceled) toast.error(iap.error ?? "The purchase didn't go through. Your account is unchanged — try again whenever you're ready.");
        return;
      }
      const val = await validateAppleReceipt(
        iap.receipt!,
        iap.productId ?? "chasehq_pro_monthly",
        iap.mock ?? false,
      );
      if (!val.ok) {
        setPaywallPhase("idle");
        toast.error(val.error ?? "We couldn't activate your subscription yet. Try again and you'll be set.");
        return;
      }
      await refetchEntitlement();
      setPaywallPhase("success");
      await new Promise((r) => setTimeout(r, 800));
      setAuthPaywallOpen(false);
      setPaywallPhase("idle");
      if (paywallIntentRef.current === "generate") {
        handleGenerate();
      } else {
        doSend();
      }
    } catch {
      setPaywallPhase("idle");
      toast.error("That didn't go through. Give it another try.");
    }
  }

  if (sent) {
    return (
      <div className="mt-4 bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center animate-in fade-in">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <p className="text-xl font-bold text-foreground">We're on it!</p>
        <p className="text-sm text-muted-foreground mt-1.5">
          Your follow-up is on its way to {invoice.client}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-card border border-border rounded-2xl p-4" ref={draftRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">AI Follow-up Draft</h3>
        {isAiGenerated && (
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI Generated</span>
        )}
      </div>

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
              onClick={() => handleToneChange(t)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${cls}`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Final Notice warning banner */}
      {isFinalNotice && (
        <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            This is a <strong>final escalation notice</strong>. It signals serious consequences for non-payment and should only be sent after earlier reminders. Review carefully before sending.
          </p>
        </div>
      )}

      {/* Subject */}
      <div className="mb-2">
        <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
        <input
          value={currentSubject}
          onChange={(e) => { setCurrentSubject(e.target.value); userEditedRef.current = true; }}
          readOnly={locked}
          className={`w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${locked ? "select-none" : ""}`}
        />
      </div>

      {/* Message body */}
      <div className="relative">
        {locked && !isGenerating && !generationError && (
          <div className="absolute inset-0 z-10 bg-card/90 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center p-4 text-center">
            <Lock className="w-5 h-5 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">
              {trialEndsAt ? "Trial ended" : "Subscription required"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3 max-w-xs">
              {trialEndsAt
                ? "Subscribe to access your drafts and keep sending."
                : "Start your free trial to generate and send follow-ups."}
            </p>
            <button
              onClick={() => setAuthPaywallOpen(true)}
              className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl"
            >
              {trialEndsAt ? "Subscribe now" : "Start free trial"}
            </button>
          </div>
        )}
        {isGenerating ? (
          <div className="space-y-2 py-3">
            <div className="h-3.5 bg-muted rounded-md animate-pulse w-full" />
            <div className="h-3.5 bg-muted rounded-md animate-pulse w-5/6" />
            <div className="h-3.5 bg-muted rounded-md animate-pulse w-full" />
            <div className="h-3.5 bg-muted rounded-md animate-pulse w-3/4" />
            <div className="h-3.5 bg-muted rounded-md animate-pulse w-full" />
            <div className="h-3.5 bg-muted rounded-md animate-pulse w-5/6" />
            <div className="h-3.5 bg-muted rounded-md animate-pulse w-full" />
            <div className="h-3.5 bg-muted rounded-md animate-pulse w-2/3" />
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating {tone.toLowerCase()} follow-up…
            </div>
          </div>
        ) : generationError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive text-center">That one didn't come through — it may be busy. Give it a moment and try again.</p>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-destructive/30 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try again
            </button>
          </div>
        ) : (
          <textarea
            value={currentDraft}
            onChange={(e) => { setCurrentDraft(e.target.value); userEditedRef.current = true; }}
            rows={10}
            readOnly={locked}
            className={`w-full bg-muted border border-border rounded-xl px-3.5 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed ${locked ? "select-none" : ""}`}
          />
        )}
      </div>

      {/* Double-send safeguard */}
      {recentlySent && !locked && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 mt-3">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            You sent a follow-up {formatAgo(msSinceLastSend!)} — sending again this soon can feel pushy.
          </p>
        </div>
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
            onClick={gate.canExecute ? handleGenerate : () => openGatePanel("generate")}
            disabled={isGenerating && !locked}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm font-medium transition-colors ${
              locked
                ? "text-muted-foreground/50 cursor-default"
                : "text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-50"
            }`}
          >
            {locked ? (
              <><Lock className="w-3.5 h-3.5" /> Locked</>
            ) : (
              <><RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />{isAiGenerated ? "Regenerate" : "Generate with AI"}</>
            )}
          </button>
        </div>
        <button
          onClick={handleSendClick}
          disabled={sending || !currentDraft}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-50 ${
            sent
              ? "bg-[hsl(var(--chart-2))] text-primary-foreground"
              : isFinalNotice
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {sent ? (
            <span className="flex items-center gap-2 animate-scale-in">
              <Check className="w-4 h-4" /> Sent. We'll take it from here.
            </span>
          ) : sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sending…
            </>
          ) : locked ? (
            <>
              <Lock className="w-4 h-4" /> Unlock to send
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> {isFinalNotice ? "Send Final Notice" : recentlySent ? "Send anyway" : "Send"}
            </>
          )}
        </button>
      </div>

      {/* Send confirmation: warm, tone-aware — shown before every non-Final-Notice send */}
      <AlertDialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this {tone.toLowerCase()} follow-up?</AlertDialogTitle>
            <AlertDialogDescription>
              {(SEND_CONFIRM_BODY[tone] ?? `This will land in ${invoice.client}'s inbox shortly.`).replace("{client}", invoice.client)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSend}>Send it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmFinalOpen} onOpenChange={setConfirmFinalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Send Final Notice to {invoice.client}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This message carries more weight than a regular reminder. Make sure all earlier follow-ups have been sent and that you intend to escalate this matter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmFinalOpen(false); doSend(); }}
              disabled={sending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {sending ? "Sending…" : "Send Final Notice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recently-sent friction gate */}
      <AlertDialog open={confirmRecentSendOpen} onOpenChange={setConfirmRecentSendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You just sent a follow-up — send again?</AlertDialogTitle>
            <AlertDialogDescription>
              {msSinceLastSend !== null ? `${formatAgo(msSinceLastSend)}. ` : ""}Sending again this quickly can come across as pushy. If you can, give it another day.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setConfirmRecentSendOpen(false)}>
              Wait a day
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => { setConfirmRecentSendOpen(false); doSend(); }}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
            >
              Send anyway
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tone-change guard — shown when a draft has been edited or AI-generated */}
      <AlertDialog open={pendingTone !== null} onOpenChange={(open) => { if (!open) setPendingTone(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch tones? This replaces your current draft.</AlertDialogTitle>
            <AlertDialogDescription>
              The new tone loads a fresh template. Your edits won't carry over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTone(null)}>Keep my draft</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingTone) setTone(pendingTone); setPendingTone(null); }}>
              Switch tones
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send-time trial + sign-up gate for guest users */}
      <MockIAPSheet
        open={iapSheetOpen}
        onConfirm={() => { setIapSheetOpen(false); setAuthDialogOpen(true); }}
        onCancel={() => setIapSheetOpen(false)}
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
            <h2 className="text-lg font-bold text-foreground mb-1">Save your trial &amp; send</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Create your account to start your 14-day free trial and deliver this follow-up.
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

      {/* Inline paywall sheet for authenticated users with expired trial or no subscription */}
      {authPaywallOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 animate-fade-in"
          onClick={() => paywallPhase === "idle" && setAuthPaywallOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-3xl shadow-2xl animate-slide-in-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-7 pb-5">
              <h2 className="text-xl font-bold text-foreground mb-2">
                {trialEndsAt ? "Your trial has ended" : "Start your free trial"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {trialEndsAt
                  ? "Subscribe to keep sending follow-ups and chasing your invoices."
                  : "14 days free, then $5/month. Cancel anytime."}
              </p>
            </div>
            <div className="px-6 pb-5 space-y-3">
              {[
                "AI-drafted follow-ups in your tone",
                "Send from your own Gmail",
                "Chase timeline & payment history",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <p className="text-sm text-foreground">{f}</p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-7">
              {!trialEndsAt && (
                <p className="text-[11px] text-muted-foreground text-center mb-3">
                  You'll be reminded 3 days before your first charge.
                </p>
              )}
              <button
                onClick={handlePaywall}
                disabled={paywallPhase !== "idle"}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-90"
              >
                {paywallPhase === "idle" && (trialEndsAt ? "Subscribe — $5/month" : "Start 14-day free trial")}
                {paywallPhase === "confirming" && (<><Loader2 className="w-4 h-4 animate-spin" />{trialEndsAt ? " Subscribing…" : " Starting trial…"}</>)}
                {paywallPhase === "success" && (<><Check className="w-4 h-4" />{trialEndsAt ? " Subscribed!" : " Trial started!"}</>)}
              </button>
              <button
                onClick={() => setAuthPaywallOpen(false)}
                disabled={paywallPhase !== "idle"}
                className="mt-3 w-full py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
