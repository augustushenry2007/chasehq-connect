import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertCircle, Info, CheckCircle, Send, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/data";
import type { Tone } from "./DraftTemplates";
import { useFlow } from "@/flow/FlowMachine";
import { startGoogleOAuth, OAUTH_USER_CANCELED } from "@/integrations/oauth";
import { restorePurchases, syncSubscriptionToSupabase } from "@/integrations/iap";
import { readPending } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { GoogleIcon } from "@/components/GoogleIcon";
import { formatAgo } from "@/lib/dates";

export type SendSheetState = "closed" | "signed_out" | "needs_trial" | "ready";

const PREVIEW_CHARS = 220;

type Props = {
  state: SendSheetState;
  intent: "send" | "generate";
  invoice: Invoice;
  currentSubject: string;
  currentDraft: string;
  isFinalNotice: boolean;
  recentlySent: boolean;
  msSinceLastSend: number | null;
  sending: boolean;
  hasFreeSend: boolean;
  followupsSent: number;
  trialEndsAt: Date | null;
  refetchEntitlement: () => void;
  onClose: () => void;
  onSend: () => void;
  onIapComplete: (intent: "send" | "generate") => void;
  onEditDraft: () => void;
};

export function SendSheet({
  state, intent, invoice, currentSubject, currentDraft,
  isFinalNotice, recentlySent, msSinceLastSend, sending,
  hasFreeSend, followupsSent, trialEndsAt, refetchEntitlement,
  onClose, onSend, onIapComplete, onEditDraft,
}: Props) {
  const { send: flowSend } = useFlow();
  const [iapLoading, setIapLoading] = useState(false);
  const [iapError, setIapError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  useEffect(() => {
    if (state === "ready") setBodyExpanded(false);
  }, [state]);

  const bodyPreview = currentDraft.length > PREVIEW_CHARS
    ? currentDraft.slice(0, PREVIEW_CHARS).trimEnd() + "…"
    : currentDraft;

  async function handleGoogleSignIn() {
    if (googleLoading) return;
    setGoogleLoading(true);
    sessionStorage.setItem(STORAGE_KEYS.SEND_AFTER_AUTH, intent);
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
    onIapComplete(intent);
  }

  async function handleStartTrial() {
    if (iapLoading) return;
    setIapLoading(true);
    setIapError(null);
    try {
      const { purchaseSubscription, getActiveEntitlement } = await import("@/integrations/iap");
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
      onClick={() => { if (!iapLoading && !googleLoading && !sending) onClose(); }}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-3xl shadow-2xl animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-border mt-3 mb-1" />

        {state === "signed_out" && (
          <div className="px-6 pt-3 pb-[max(env(safe-area-inset-bottom,16px),24px)]">
            <h2 className="text-lg font-bold text-foreground mb-1">Sign in to continue</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {intent === "generate"
                ? "Create your account to generate AI drafts. ChaseHQ sends follow-ups for you — you review every message."
                : `Create your account to send to ${invoice.clientEmail || invoice.client}. ChaseHQ sends follow-ups for you — you review every message and replies come back to your inbox.`}
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
              onClick={onClose}
              disabled={googleLoading}
              className="mt-3 w-full py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Maybe later
            </button>
          </div>
        )}

        {state === "needs_trial" && (
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
                "Replies route straight back to you",
                "Chase timeline & payment history",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
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
                trialEndsAt ? "Subscribe — $9.99/month" : "Start Your 14-Day Trial"
              )}
            </button>
            <button
              onClick={onClose}
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

        {state === "ready" && (
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
              onClick={onSend}
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
              onClick={onEditDraft}
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
  );
}
