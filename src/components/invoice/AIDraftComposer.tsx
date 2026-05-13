import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Send, Loader2, AlertCircle, Info, CheckCircle, Shuffle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/data";
import { generateFollowupStream, sendFollowupEmail } from "@/hooks/useSupabaseData";
import { advanceScheduleAfterSend } from "@/hooks/useNotifications";
import { getDefaultDraft, getTemplateDraft, TEMPLATE_COUNT, type Tone } from "./DraftTemplates";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useActionGate } from "@/hooks/useActionGate";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { restorePurchases, syncSubscriptionToSupabase } from "@/integrations/iap";
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

// Module-scoped so an in-flight send survives a navigation/remount. A second
// AIDraftComposer instance (e.g. opened on another invoice's detail screen)
// shares this set, so it can't slip a concurrent free send past the per-instance
// guard while the first send's followups row hasn't been written yet.
const inFlightSendUsers = new Set<string>();

function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

type SendSheetState = "closed" | "needs_trial" | "ready";

export default function AIDraftComposer({ invoice, onSent, defaultTone }: { invoice: Invoice; onSent?: () => void; defaultTone?: Tone }) {
  const { user, notifications, fullName, userProfile, isDemo } = useApp();
  const entitlement = useEntitlement();
  const { trialEndsAt, refetch: refetchEntitlement, hasFreeSend } = entitlement;
  const gate = useActionGate();

  const [tone, setTone] = useState<Tone>((defaultTone ?? notifications.defaultTone) as Tone);
  const [currentSubject, setCurrentSubject] = useState("");
  const [currentDraft, setCurrentDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(false);
  const [sendStage, setSendStage] = useState<"idle" | "showing" | "exiting">("idle");
  // While a real send is in flight the toast says "Sending…" (a spinner, no green
  // check) and won't auto-dismiss; it flips to "Sent" only once the send is
  // confirmed. So the green check is never shown before the email is actually out.
  const [sendOutcome, setSendOutcome] = useState<"pending" | "sent">("pending");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [templateIndex, setTemplateIndex] = useState(0);
  const [pendingTone, setPendingTone] = useState<Tone | null>(null);
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
  const sendInFlight = () => !!user?.id && inFlightSendUsers.has(user.id);

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
    const def = getDefaultDraft(invoice, tone, fullName || undefined, userProfile);
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
    const t = getTemplateDraft(invoice, tone, nextIndex, fullName || undefined, userProfile);
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

    // Demo mode: simulate AI generation with a realistic delay and a polished fake draft.
    if (isDemo) {
      await new Promise((r) => setTimeout(r, 1400));
      const def = getDefaultDraft(invoice, tone, fullName || undefined, userProfile);
      setCurrentSubject(def.subject);
      setCurrentDraft(def.message);
      setIsAiGenerated(true);
      setGenerationError(false);
      userEditedRef.current = false;
      setIsGenerating(false);
      return;
    }

    const displayName = fullName?.trim() ? fullName.trim().replace(/\b\w/g, c => c.toUpperCase()) : undefined;
    const previousDraft = isAiGenerated ? currentDraft : undefined;
    // Clear the editor while we stream in the new draft. Without this the
    // skeleton (which gates on `isGenerating && !currentDraft`) never shows
    // on Regenerate because the prior draft is still in state.
    setCurrentSubject("");
    setCurrentDraft("");

    let streamedMessage = "";
    let errorReason: { kind: "rate_limited" | "error"; message?: string } | null = null;

    await generateFollowupStream(
      invoice, tone, previousDraft, displayName, userProfile,
      {
        onSubject: (s) => setCurrentSubject(s),
        onMessageDelta: (delta) => {
          streamedMessage += delta;
          setCurrentDraft(streamedMessage);
        },
        onDone: () => { /* finalization handled below */ },
        onError: (kind, message) => { errorReason = { kind, message }; },
      },
    );

    if (errorReason) {
      const reason = errorReason as { kind: "rate_limited" | "error"; message?: string };
      if (reason.kind === "rate_limited") {
        toast.error(reason.message || "AI is busy right now. Wait a moment and try again.");
        // Don't clobber the editor with a fallback on rate-limit — leave it
        // empty so the user can tap Regenerate without losing context.
        setIsAiGenerated(false);
        setGenerationError(true);
      } else {
        const fallback = getDefaultDraft(invoice, tone, fullName || undefined, userProfile);
        setCurrentSubject(fallback.subject);
        setCurrentDraft(fallback.message);
        setIsAiGenerated(false);
        setGenerationError(true);
        if (reason.message) toast.error(reason.message);
      }
      userEditedRef.current = false;
    } else {
      // Surface the "came out similar" hint even on the streamed path.
      if (previousDraft && streamedMessage.trim() === previousDraft.trim()) {
        toast.message("That one came out similar. Regenerate or switch tones for a different feel.");
      }
      setIsAiGenerated(true);
      setGenerationError(false);
      userEditedRef.current = false;
    }
    setIsGenerating(false);
    setTimeout(() => {
      const rect = draftRef.current?.getBoundingClientRect();
      if (rect && rect.top > window.innerHeight * 0.7) {
        draftRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);
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
    if (import.meta.env.DEV) {
      console.log("[NEEDS_TRIAL via openSendSheet]", {
        gateState: gate.state, canExecute: gate.canExecute,
        hasFreeSend: entitlement.hasFreeSend, panelVariant: gate.panelVariant,
      });
    }
    setSendSheet("needs_trial");
  }

  function handleSendClick() {
    // Block re-entry while a send is in flight — prevents stale canSend routing
    // if the user taps again before noteFollowupSent() commits (2–5s window).
    if (sendInFlight()) return;

    if (gate.state === "loading" || entitlement.loading) return;
    if (!entitlement.canSend) {
      openSendSheet("send");
      return;
    }
    setSendSheet("ready");
    setBodyExpanded(false);
  }

  function startSentToastDismissTimer() {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setSendStage("exiting");
      hideTimerRef.current = setTimeout(() => setSendStage("idle"), 600);
    }, 3500);
  }

  function showSentToast(outcome: "pending" | "sent" = "pending") {
    setSendStage("showing");
    setSendOutcome(outcome);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    // "pending" stays up until the send resolves (could be ~15s); only "sent"
    // (or the demo path) auto-dismisses.
    if (outcome === "sent") startSentToastDismissTimer();
  }

  function markSentToastDelivered() {
    setSendOutcome("sent");
    startSentToastDismissTimer();
  }

  function hideSentToast() {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setSendStage("idle");
  }

  function handleSheetSend() {
    if (sendInFlight()) return;
    if (!currentDraft || !currentSubject) {
      toast.error("Add a subject and message before sending.");
      return;
    }
    if (!invoice.clientEmail) {
      toast.error("Add your client's email so we can send this for you.");
      return;
    }

    // Snapshot mutable inputs at tap time so the background call uses exactly
    // what the user saw, even if state changes while the call is in flight.
    const snapshot = {
      clientEmail: invoice.clientEmail,
      subject: currentSubject,
      draft: currentDraft,
      dbId: invoice.dbId,
      tone,
      isAiGenerated,
    };

    setSendSheet("closed");

    // Demo mode: instant confirmation, no real network call.
    if (isDemo) {
      showSentToast("sent");
      return;
    }

    const uid = user?.id;
    if (!uid) return; // not reachable in practice — the ready sheet requires auth
    inFlightSendUsers.add(uid);

    // Show "Sending follow-up to {client}…" immediately; the background send
    // flips it to "Follow-up sent" only once confirmed.
    showSentToast("pending");
    void performBackgroundSend(snapshot, uid);
  }

  async function performBackgroundSend(snapshot: {
    clientEmail: string;
    subject: string;
    draft: string;
    dbId: string;
    tone: Tone;
    isAiGenerated: boolean;
  }, uid: string) {
    try {
      const result = await sendFollowupEmail(
        snapshot.clientEmail, snapshot.subject, snapshot.draft, snapshot.dbId, snapshot.tone, snapshot.isAiGenerated,
      );

      if (!result.ok) {
        hideSentToast();
        if (result.reason === "subscription_required") {
          if (import.meta.env.DEV) {
            console.log("[NEEDS_TRIAL via backend rejection]", { result });
          }
          // Global toast too — setSendSheet is a no-op if the composer unmounted
          // (user navigated away from the invoice detail screen during the send).
          toast.error(result.message || "Your trial has ended. Subscribe to keep sending follow-ups.");
          setSendSheet("needs_trial");
          return;
        }
        if (result.reason === "rate_limited") {
          toast.error(result.message || "You've hit today's send limit. We'll be ready again tomorrow.");
        } else {
          toast.error(result.message || "We couldn't send this one. Your draft is safe — give it another try.");
        }
        return;
      }

      // Confirmed — now flip the toast from "Sending…" to "Follow-up sent".
      markSentToastDelivered();

      // The followups timeline row is written server-side by send-email now.
      // Flip hasFreeSend to false synchronously so the next tap routes to the
      // trial paywall instead of re-rendering the "Your first follow-up is on us"
      // sheet while the realtime followups INSERT is still in flight.
      entitlement.noteFollowupSent();
      await advanceScheduleAfterSend(snapshot.dbId, snapshot.tone);

      setLastSentAt(new Date());
      onSent?.();
    } catch {
      hideSentToast();
      toast.error("We couldn't send this one. Your draft is safe — give it another try.");
    } finally {
      inFlightSendUsers.delete(uid);
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

  // syncSubscriptionToSupabase couldn't write the `subscriptions` row after the
  // retries (e.g. validate-apple-receipt briefly down). The purchase itself went
  // through on-device, so useEntitlement's RevenueCat fallback should still let
  // the user send — re-check it now, and tell them in case it doesn't clear.
  const onSubscriptionSyncFailed = () => {
    void refetchEntitlement();
    toast.error("We couldn't confirm your subscription just yet. You can keep using ChaseHQ — reopen the app if anything looks off.");
  };
  const onSubscriptionSynced = () => { void refetchEntitlement(); };

  async function handleStartTrial() {
    if (iapLoading) return;
    setIapLoading(true);
    setIapError(null);
    try {
      const { purchaseSubscription, getActiveEntitlement } = await import("@/integrations/iap");

      const existing = await getActiveEntitlement();
      if (existing?.entitled) {
        void syncSubscriptionToSupabase(`RC_CUSTOMER:${existing.originalAppUserId}`, "chasehq_pro_monthly", false, {
          onSynced: onSubscriptionSynced,
          onFailed: onSubscriptionSyncFailed,
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
        onSynced: onSubscriptionSynced,
        onFailed: onSubscriptionSyncFailed,
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
        onSynced: onSubscriptionSynced,
        onFailed: onSubscriptionSyncFailed,
        isTrialing: result.isTrialing,
        expiresAt: result.expiresAt,
      });
      completeIap();
    } catch {
      setIapLoading(false);
      setIapError("Restore didn't go through. Give it another try.");
    }
  }

  return (
    <div className="mt-4 bg-card border border-border rounded-3xl p-4" style={{ boxShadow: "var(--shadow-card)" }} ref={draftRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.01em]">AI Follow-up Draft</h3>
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
        {/* Skeleton until the first streamed byte lands. Once `currentDraft`
            is non-empty the streamed text takes over and renders live. */}
        {isGenerating && !currentDraft ? (
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
        ) : (
          <>
            {generationError && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 rounded-xl bg-muted border border-border/60">
                <p className="text-xs text-muted-foreground">AI is busy — template loaded.</p>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1 text-xs font-medium text-primary shrink-0"
                >
                  <RefreshCw className="w-3 h-3" /> Try AI
                </button>
              </div>
            )}
            <textarea
              value={currentDraft}
              onChange={(e) => { setCurrentDraft(e.target.value); userEditedRef.current = true; }}
              onCopy={user ? undefined : (e) => e.preventDefault()}
              onCut={user ? undefined : (e) => e.preventDefault()}
              onContextMenu={user ? undefined : (e) => e.preventDefault()}
              rows={10}
              style={{ fontSize: "16px" }}
              className={`w-full bg-muted border border-border rounded-xl px-3.5 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed${user ? "" : " select-none [-webkit-user-select:none]"}`}
            />
          </>
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
          disabled={!currentDraft}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.97] disabled:opacity-50 shadow-[0_8px_24px_rgba(91,123,142,0.25)] hover:shadow-[0_12px_32px_rgba(91,123,142,0.30)] ${
            isFinalNotice
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          <><Send className="w-4 h-4" /> {isFinalNotice ? "Send Final Notice" : recentlySent ? "Send anyway" : "Send"}</>
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

      {/* Send Sheet — single bottom sheet that handles trial paywall and send confirmation */}
      {sendSheet !== "closed" && createPortal(
        <div
          data-oauth-sheet
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
          onClick={() => { if (!iapLoading) setSendSheet("closed"); }}
        >
          <div
            data-oauth-sheet-card
            className="w-full max-w-md bg-card rounded-t-3xl shadow-2xl border-t border-border/30 animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-border mt-3 mb-1" />

            {/* State: NEEDS_TRIAL */}
            {sendSheet === "needs_trial" && (
              <div className="px-5 pt-3 pb-[max(env(safe-area-inset-bottom,16px),24px)]">
                <h2 className="text-base font-bold text-foreground mb-1">
                  {trialEndsAt ? "Your trial has ended" : "Start Your 14-Day Trial"}
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  {trialEndsAt
                    ? "Subscribe to keep sending follow-ups."
                    : "14 days free, then $9.99/month. Cancel anytime."}
                </p>
                <div className="space-y-2 mb-4">
                  {[
                    "AI-drafted follow-ups in your tone",
                    "Sent under your name, with replies routed to you",
                    "Chase timeline & payment history",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      </span>
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
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-90 mb-2 shadow-[0_8px_24px_rgba(91,123,142,0.25)]"
                >
                  {iapLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{trialEndsAt ? " Subscribing…" : " Starting trial…"}</>
                  ) : (
                    trialEndsAt ? "Subscribe — $9.99/month" : "Start Your 14-Day Trial"
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
                <h2 className="text-[18px] font-bold text-foreground tracking-[-0.02em] mb-0.5">
                  {hasFreeSend
                    ? "Your first follow-up is on us"
                    : isFinalNotice ? `Send Final Notice to ${invoice.client}?` : `Send to ${invoice.client}?`}
                </h2>
                <p className="text-[13px] text-muted-foreground mb-3">
                  {hasFreeSend
                    ? `Sending to ${invoice.clientEmail || invoice.client} · your next follow-up starts your free trial`
                    : `To: ${invoice.clientEmail || invoice.client}`}
                </p>

                <div className="bg-muted border border-border/60 rounded-xl px-3 py-2 mb-2">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Subject</p>
                  <p className="text-xs text-foreground font-medium">{currentSubject}</p>
                </div>

                <div className="bg-muted border border-border/60 rounded-xl px-3 py-2 mb-3">
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
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] mb-2 shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${
                    isFinalNotice
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  <><Send className="w-4 h-4" /> {isFinalNotice ? "Send Final Notice" : "Send message"}</>
                </button>
                <button
                  onClick={() => {
                    setSendSheet("closed");
                    requestAnimationFrame(() => {
                      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Edit draft
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Fixed bottom toast — visible regardless of scroll position */}
      {sendStage !== "idle" && createPortal(
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 72px)" }}
        >
          <div
            className={`w-full max-w-sm bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-all duration-500 ${
              sendStage === "exiting"
                ? "opacity-0 translate-y-4"
                : "animate-in slide-in-from-bottom-4 fade-in duration-300"
            }`}
            style={{ boxShadow: "var(--shadow-card-lg)" }}
            onClick={() => {
              if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
              setSendStage("exiting");
              hideTimerRef.current = setTimeout(() => setSendStage("idle"), 500);
            }}
          >
            {sendOutcome === "sent" ? (
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-[18px] h-[18px] text-green-500" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Loader2 className="w-[18px] h-[18px] text-primary animate-spin" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-foreground">{sendOutcome === "sent" ? "Sent" : "Sending…"}</p>
              <p className="text-[12px] text-muted-foreground leading-snug">
                {sendOutcome === "sent"
                  ? `Follow-up sent to ${invoice.client}.`
                  : `Sending follow-up to ${invoice.client}…`}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
