import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Send, Loader2, AlertCircle, Info, Check, CheckCircle, Shuffle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/data";
import { generateFollowup, sendFollowupEmail, recordFollowup } from "@/hooks/useSupabaseData";
import { advanceScheduleAfterSend } from "@/hooks/useNotifications";
import { getDefaultDraft, getTemplateDraft, TEMPLATE_COUNT, type Tone } from "./DraftTemplates";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useActionGate } from "@/hooks/useActionGate";
import { useApp } from "@/context/AppContext";
import { useFlow } from "@/flow/FlowMachine";
import { supabase } from "@/integrations/supabase/client";
import { startGoogleOAuth, OAUTH_USER_CANCELED } from "@/lib/oauth";
import { isNativePlatform, restorePurchases, syncSubscriptionToSupabase } from "@/lib/iap";
import { readPending } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { GoogleIcon } from "@/components/GoogleIcon";
import { CoachHint } from "@/components/onboarding/CoachHint";
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

const TONES: Tone[] = ["Friendly", "Firm", "Urgent", "Final Notice"];
const PREVIEW_CHARS = 220;

function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

type SendSheetState = "closed" | "signed_out" | "needs_trial" | "ready";

export default function AIDraftComposer({ invoice, onSent, defaultTone }: { invoice: Invoice; onSent?: () => void; defaultTone?: Tone }) {
  const { user, notifications, fullName } = useApp();
  const { send: flowSend } = useFlow();
  const entitlement = useEntitlement();
  const { canSend, trialEndsAt, refetch: refetchEntitlement, isTrialing, isActive, isPastDue, hasFreeSend, followupsSent } = entitlement;
  const gate = useActionGate();

  const [tone, setTone] = useState<Tone>((defaultTone ?? notifications.defaultTone) as Tone);
  const [currentSubject, setCurrentSubject] = useState("");
  const [currentDraft, setCurrentDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStage, setSendStage] = useState<"idle" | "showing" | "exiting">("idle");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [pendingTone, setPendingTone] = useState<Tone | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  // Send Sheet — single state machine that replaces all auth/paywall/confirm modals
  const [sendSheet, setSendSheet] = useState<SendSheetState>("closed");
  const [sendSheetIntent, setSendSheetIntent] = useState<"send" | "generate">("send");
  const [iapLoading, setIapLoading] = useState(false);
  const [iapError, setIapError] = useState<string | null>(null);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  const draftRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const userEditedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFinalNotice = tone === "Final Notice";
  const msSinceLastSend = lastSentAt ? Date.now() - lastSentAt.getTime() : null;
  const recentlySent = msSinceLastSend !== null && msSinceLastSend < 24 * 3_600_000;
  const bodyPreview = currentDraft.length > PREVIEW_CHARS
    ? currentDraft.slice(0, PREVIEW_CHARS).trimEnd() + "…"
    : currentDraft;

  useEffect(() => {
    if (invoice.dbId === "guest") return;
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

  // When the parent changes defaultTone (e.g. "Send now" on a different step), adopt it
  // if the user hasn't started editing yet.
  useEffect(() => {
    if (defaultTone && !userEditedRef.current && !isAiGenerated) {
      setTone(defaultTone);
    }
  }, [defaultTone]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Resume the correct sheet state after Google OAuth.
  // Routes immediately once the gate settles — no refetch dance needed because
  // useEntitlement's count ?? 0 coercion already gives the right answer.
  useEffect(() => {
    if (!user) return;
    const intent = sessionStorage.getItem(STORAGE_KEYS.SEND_AFTER_AUTH) as "send" | "generate" | null;
    if (!intent) return;
    if (gate.state === "loading") return;

    sessionStorage.removeItem(STORAGE_KEYS.SEND_AFTER_AUTH);

    if (import.meta.env.DEV) {
      console.log("[POST_OAUTH_RESUME]", {
        intent,
        gateState: gate.state,
        canExecute: gate.canExecute,
        hasFreeSend: entitlement.hasFreeSend,
        isTrialing: entitlement.isTrialing,
        isActive: entitlement.isActive,
      });
    }

    if (gate.canExecute) {
      if (intent === "generate") { void handleGenerate(); }
      else { setSendSheet("ready"); setBodyExpanded(false); }
    } else {
      setSendSheetIntent(intent);
      setIapError(null);
      setSendSheet("needs_trial");
    }
    // Signal OAuthOverlay to re-evaluate dismissal now that the modal is committed
    // and SEND_AFTER_AUTH has been cleared — this is what drops the spinner.
    window.dispatchEvent(new Event("chasehq:oauth-signal"));
  }, [user, gate.state, gate.canExecute]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationError(false);
    const displayName = fullName?.trim() ? fullName.trim().replace(/\b\w/g, c => c.toUpperCase()) : undefined;
    let result = await generateFollowup(invoice, tone, isAiGenerated ? currentDraft : undefined, displayName);
    if (!result) {
      result = await generateFollowup(invoice, tone, undefined, displayName);
    }
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

  function openSendSheet(intent: "send" | "generate") {
    setSendSheetIntent(intent);
    setIapError(null);
    if (!user || gate.panelVariant === "guest") {
      setSendSheet("signed_out");
    } else {
      if (import.meta.env.DEV) {
        console.log("[NEEDS_TRIAL via openSendSheet]", {
          gateState: gate.state, canExecute: gate.canExecute,
          hasFreeSend: entitlement.hasFreeSend, panelVariant: gate.panelVariant,
        });
      }
      setSendSheet("needs_trial");
    }
  }

  function handleSendClick() {
    if (gate.state === "loading") return;
    if (!gate.canExecute) { openSendSheet("send"); return; }
    setSendSheet("ready");
    setBodyExpanded(false);
  }

  async function handleSheetSend() {
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

    if (!result.ok) {
      setSending(false);
      if (result.reason === "subscription_required") {
        if (import.meta.env.DEV) {
          console.log("[NEEDS_TRIAL via backend rejection]", { result });
        }
        setSendSheet("needs_trial");
        return;
      }
      setSendSheet("closed");
      if (result.reason === "no_mailbox") {
        toast.error("Connect your Gmail in Settings and we'll send this for you.");
      } else if (result.reason === "rate_limited") {
        toast.error(result.message || "You've hit today's send limit. We'll be ready again tomorrow.");
      } else {
        toast.error(result.message || "We couldn't send this one. Your draft is safe — give it another try.");
      }
      return;
    }

    if (user?.id) {
      await recordFollowup(user.id, invoice.dbId, {
        subject: currentSubject,
        message: currentDraft,
        tone,
        isAiGenerated,
      });
    }
    await advanceScheduleAfterSend(invoice.dbId, tone);

    setSending(false);
    setSendSheet("closed");
    setLastSentAt(new Date());
    onSent?.();
    setSendStage("showing");
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setSendStage("exiting");
      hideTimerRef.current = setTimeout(() => setSendStage("idle"), 600);
    }, 3500);
  }

  async function handleGoogleSignIn() {
    if (googleLoading) return;
    setGoogleLoading(true);
    sessionStorage.setItem(STORAGE_KEYS.SEND_AFTER_AUTH, sendSheetIntent);
    try {
      flowSend("REQUEST_POST_INVOICE_AUTH");
      const pi = readPending();
      const piSuffix = pi ? "?pi=" + encodeURIComponent(JSON.stringify(pi)) : "";
      const { error } = await startGoogleOAuth(window.location.origin + "/auth-after-invoice" + piSuffix);
      if (error) {
        if (error.code !== OAUTH_USER_CANCELED) {
          toast.error("Sign-in didn't go through. Give it another try.");
        }
        sessionStorage.removeItem(STORAGE_KEYS.SEND_AFTER_AUTH);
        setGoogleLoading(false);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEYS.SEND_AFTER_AUTH);
      toast.error("Sign-in didn't go through. Give it another try.");
      setGoogleLoading(false);
    }
  }

  function completeIap() {
    setIapLoading(false);
    if (sendSheetIntent === "generate") {
      setSendSheet("closed");
      handleGenerate();
    } else {
      setSendSheet("ready");
      setBodyExpanded(false);
    }
  }

  async function handleStartTrial() {
    if (iapLoading) return;
    setIapLoading(true);
    setIapError(null);
    try {
      const { purchaseSubscription, getActiveEntitlement } = await import("@/lib/iap");

      const existing = await getActiveEntitlement();
      if (existing?.entitled) {
        void syncSubscriptionToSupabase(`RC_CUSTOMER:${existing.originalAppUserId}`, "chasehq_pro_monthly", false, {
          onSynced: () => { void refetchEntitlement(); },
          isTrialing: existing.isTrialing,
          expiresAt: existing.expiresAt,
        });
        completeIap();
        return;
      }

      const iap = await purchaseSubscription();
      if (!iap.ok) {
        setIapLoading(false);
        if (!iap.canceled) setIapError(iap.error ?? "The purchase didn't go through. Try again.");
        return;
      }
      if (!iap.entitled) {
        setIapLoading(false);
        setIapError("Purchase didn't grant access yet. Try Restore Purchases.");
        return;
      }

      void syncSubscriptionToSupabase(iap.receipt!, iap.productId ?? "chasehq_pro_monthly", iap.mock ?? false, {
        onSynced: () => { void refetchEntitlement(); },
        isTrialing: iap.isTrialing,
        expiresAt: iap.expiresAt,
      });

      completeIap();
    } catch {
      setIapLoading(false);
      setIapError("That didn't go through. Give it another try.");
    }
  }

  async function handleRestorePurchases() {
    if (iapLoading) return;
    setIapLoading(true);
    setIapError(null);
    try {
      const result = await restorePurchases();
      if (!result.ok) {
        setIapLoading(false);
        setIapError(result.error ?? "No active subscription found on this account.");
        return;
      }
      void syncSubscriptionToSupabase(result.receipt!, result.productId ?? "chasehq_pro_monthly", result.mock ?? false, {
        onSynced: () => { void refetchEntitlement(); },
        isTrialing: result.isTrialing,
        expiresAt: result.expiresAt,
      });
      completeIap();
    } catch {
      setIapLoading(false);
      setIapError("Restore didn't go through. Give it another try.");
    }
  }

  if (sendStage !== "idle") {
    const exiting = sendStage === "exiting";
    return (
      <div
        className={`mt-4 bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 ${exiting ? "opacity-0 -translate-y-1" : "animate-in fade-in"}`}
        onClick={() => {
          if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          setSendStage("exiting");
          hideTimerRef.current = setTimeout(() => setSendStage("idle"), 600);
        }}
      >
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <p className="text-xl font-bold text-foreground">We're on it!</p>
        <p className="text-sm text-muted-foreground mt-1.5">
          Your follow-up is on its way to {invoice.client}.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          We'll let you know if {invoice.client} replies.
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
      <CoachHint hintKey="tone_selector" side="top" title="Pick a tone" body="The tone shapes the email — Friendly for early nudges, Final Notice for last attempts. Tap one to see the draft change.">
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
      </CoachHint>

      {/* Final Notice warning banner */}
      {isFinalNotice && (
        <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            This is a <strong>final escalation notice</strong>. It signals serious consequences for non-payment and should only be sent after earlier reminders. Review carefully before sending.
          </p>
        </div>
      )}

      {/* Subject + body — ref used to scroll here from "Edit draft" */}
      <div ref={editorRef}>
      {/* Subject */}
      <div className="mb-2">
        <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
        <input
          value={currentSubject}
          onChange={(e) => { setCurrentSubject(e.target.value); userEditedRef.current = true; }}
          onCopy={user ? undefined : (e) => e.preventDefault()}
          onCut={user ? undefined : (e) => e.preventDefault()}
          onContextMenu={user ? undefined : (e) => e.preventDefault()}
          className={`w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30${user ? "" : " select-none [-webkit-user-select:none]"}`}
        />
      </div>

      {/* Message body */}
      <div>
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
            <AlertCircle className="w-5 h-5 text-destructive" />
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
            onCopy={user ? undefined : (e) => e.preventDefault()}
            onCut={user ? undefined : (e) => e.preventDefault()}
            onContextMenu={user ? undefined : (e) => e.preventDefault()}
            rows={10}
            className={`w-full bg-muted border border-border rounded-xl px-3.5 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed${user ? "" : " select-none [-webkit-user-select:none]"}`}
          />
        )}
      </div>
      </div>

      {/* Double-send safeguard */}
      {recentlySent && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 mt-3">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
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
          <CoachHint hintKey="generate_ai" side="top" title="Generate with AI" body="Tap to draft a personalized follow-up using your invoice details and chosen tone. Edit or send it as-is.">
          <button
            onClick={gate.state === "loading" ? undefined : gate.canExecute ? handleGenerate : () => openSendSheet("generate")}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />{isAiGenerated ? "Regenerate" : "Generate with AI"}
          </button>
          </CoachHint>
        </div>
        <button
          onClick={handleSendClick}
          disabled={sending || !currentDraft}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-50 ${
            isFinalNotice
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {sending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
          ) : (
            <><Send className="w-4 h-4" /> {isFinalNotice ? "Send Final Notice" : recentlySent ? "Send anyway" : "Send"}</>
          )}
        </button>
      </div>

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

      {/* Send Sheet — single bottom sheet that handles auth, trial, and send confirmation */}
      {sendSheet !== "closed" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
          onClick={() => { if (!iapLoading && !googleLoading && !sending) setSendSheet("closed"); }}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl shadow-2xl animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-border mt-3 mb-1" />

            {/* State: SIGNED_OUT */}
            {sendSheet === "signed_out" && (
              <div className="px-6 pt-3 pb-[max(env(safe-area-inset-bottom,16px),24px)]">
                <h2 className="text-lg font-bold text-foreground mb-1">Sign in to continue</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  {sendSheetIntent === "generate"
                    ? "Create your account to generate AI drafts. ChaseHQ sends from your Gmail — you review every message."
                    : `Create your account to send to ${invoice.clientEmail || invoice.client}. ChaseHQ sends from your Gmail — you review every message.`}
                </p>
                <button
                  onClick={handleGoogleSignIn}
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
                <p className="text-xs text-muted-foreground text-center mt-3">Your draft is saved.</p>
                <button
                  onClick={() => setSendSheet("closed")}
                  disabled={googleLoading}
                  className="mt-3 w-full py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  Maybe later
                </button>
              </div>
            )}

            {/* State: NEEDS_TRIAL */}
            {sendSheet === "needs_trial" && (
              <div className="px-5 pt-3 pb-[max(env(safe-area-inset-bottom,16px),24px)]">
                <h2 className="text-base font-bold text-foreground mb-1">
                  {trialEndsAt ? "Your trial has ended" : "Start Your 14-Day Trial"}
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  {trialEndsAt
                    ? "Subscribe to keep sending follow-ups."
                    : "14 days free, then $19.99/month. Cancel anytime."}
                </p>
                <div className="space-y-2 mb-4">
                  {[
                    "AI-drafted follow-ups in your tone",
                    "Send from your own Gmail",
                    "Chase timeline & payment history",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <p className="text-xs text-foreground">{f}</p>
                    </div>
                  ))}
                </div>
                {iapError && (
                  <p className="text-xs text-destructive mb-2 text-center">{iapError}</p>
                )}
                <button
                  onClick={handleStartTrial}
                  disabled={iapLoading}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-90 mb-2"
                >
                  {iapLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{trialEndsAt ? " Subscribing…" : " Starting trial…"}</>
                  ) : (
                    trialEndsAt ? "Subscribe — $19.99/month" : "Start Your 14-Day Trial"
                  )}
                </button>
                <button
                  onClick={() => setSendSheet("closed")}
                  disabled={iapLoading}
                  className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  Maybe later
                </button>
                <button
                  onClick={handleRestorePurchases}
                  disabled={iapLoading}
                  className="mt-1 w-full py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  Restore purchases
                </button>
              </div>
            )}

            {/* State: READY — explicit send confirmation with message preview */}
            {sendSheet === "ready" && (
              <div className="px-5 pt-3 pb-[max(env(safe-area-inset-bottom,16px),24px)]">
                <h2 className="text-base font-bold text-foreground mb-0.5">
                  {hasFreeSend
                    ? (followupsSent === 0 ? "Your first follow-up is on us" : "This one's on us")
                    : isFinalNotice ? `Send Final Notice to ${invoice.client}?` : `Send to ${invoice.client}?`}
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  {hasFreeSend
                    ? followupsSent === 0
                      ? `Sending to ${invoice.clientEmail || invoice.client} · your next follow-up starts your free trial`
                      : `Sending to ${invoice.clientEmail || invoice.client} · after this, your free 14-day trial begins`
                    : `To: ${invoice.clientEmail || invoice.client}`}
                </p>

                <div className="bg-muted rounded-xl px-3 py-2 mb-2">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Subject</p>
                  <p className="text-xs text-foreground font-medium">{currentSubject}</p>
                </div>

                <div className="bg-muted rounded-xl px-3 py-2 mb-3">
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {bodyExpanded ? currentDraft : bodyPreview}
                  </p>
                  {currentDraft.length > PREVIEW_CHARS && (
                    <button
                      onClick={() => setBodyExpanded(!bodyExpanded)}
                      className="mt-1.5 flex items-center gap-1 text-[11px] text-primary"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${bodyExpanded ? "rotate-180" : ""}`} />
                      {bodyExpanded ? "Show less" : "Show full message"}
                    </button>
                  )}
                </div>

                {isFinalNotice && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 mb-3">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                      This is a final escalation notice. Review carefully before sending.
                    </p>
                  </div>
                )}

                {recentlySent && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 mb-3">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      You sent a follow-up {formatAgo(msSinceLastSend!)} — this could come across as pushy.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSheetSend}
                  disabled={sending}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-80 mb-2 ${
                    isFinalNotice
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="w-4 h-4" /> {isFinalNotice ? "Send Final Notice" : "Send message"}</>
                  )}
                </button>
                <button
                  onClick={() => {
                    setSendSheet("closed");
                    requestAnimationFrame(() => {
                      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  disabled={sending}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  Edit draft
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
