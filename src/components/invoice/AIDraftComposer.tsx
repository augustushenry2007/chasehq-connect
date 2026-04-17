import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Send, Loader2, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/data";
import { generateFollowup, sendFollowupEmail } from "@/hooks/useSupabaseData";
import { getDefaultDraft, type Tone } from "./DraftTemplates";
import { useEntitlement } from "@/hooks/useEntitlement";
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

export default function AIDraftComposer({ invoice }: { invoice: Invoice }) {
  const navigate = useNavigate();
  const { canSend, loading: entLoading } = useEntitlement();
  const [tone, setTone] = useState<Tone>("Friendly");
  const [currentSubject, setCurrentSubject] = useState("");
  const [currentDraft, setCurrentDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [confirmFinalOpen, setConfirmFinalOpen] = useState(false);
  const draftRef = useRef<HTMLDivElement>(null);
  const userEditedRef = useRef(false);

  const isFinalNotice = tone === "Final Notice";
  const locked = !entLoading && !canSend;

  // Load template when tone changes (resets AI flag and discards manual edits)
  useEffect(() => {
    const def = getDefaultDraft(invoice, tone);
    setCurrentSubject(def.subject);
    setCurrentDraft(def.message);
    setIsAiGenerated(false);
    userEditedRef.current = false;
  }, [tone, invoice]);

  async function handleGenerate() {
    setIsGenerating(true);
    const result = await generateFollowup(invoice, tone, isAiGenerated ? currentDraft : undefined);
    if (result) {
      if (result.message === currentDraft) {
        toast.message("Got a similar draft — try regenerating again or switching tone.");
      }
      setCurrentDraft(result.message);
      setCurrentSubject(result.subject);
      setIsAiGenerated(true);
      userEditedRef.current = false;
    }
    setIsGenerating(false);
    setTimeout(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }

  function handleToneChange(t: Tone) {
    setTone(t);
  }

  async function doSend() {
    if (!currentDraft) {
      toast.error("No draft to send");
      return;
    }
    setSending(true);
    const subject = isFinalNotice && !/^FINAL NOTICE/i.test(currentSubject)
      ? `FINAL NOTICE — ${currentSubject}`
      : currentSubject || `Follow-up: ${invoice.id}`;
    const success = await sendFollowupEmail(invoice.clientEmail, subject, currentDraft);
    setSending(false);
    if (success) {
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    }
  }

  function handleSendClick() {
    if (locked) {
      navigate("/paywall");
      return;
    }
    if (isFinalNotice) {
      setConfirmFinalOpen(true);
    } else {
      doSend();
    }
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
          className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Message body */}
      {isGenerating ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Generating {tone.toLowerCase()} follow-up…</span>
        </div>
      ) : (
        <textarea
          value={currentDraft}
          onChange={(e) => { setCurrentDraft(e.target.value); userEditedRef.current = true; }}
          rows={10}
          className="w-full bg-muted border border-border rounded-xl px-3.5 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-2.5 mt-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
          {isAiGenerated ? "Regenerate" : "Generate with AI"}
        </button>
        <button
          onClick={handleSendClick}
          disabled={sending || !currentDraft}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
            sent
              ? "bg-[hsl(var(--chart-2))] text-primary-foreground"
              : isFinalNotice
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {sent ? (
            "Sent ✓"
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
              <Send className="w-4 h-4" /> {isFinalNotice ? "Send Final Notice" : "Send"}
            </>
          )}
        </button>
      </div>

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
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Send Final Notice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
