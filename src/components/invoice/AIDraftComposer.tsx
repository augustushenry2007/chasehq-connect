import { useState, useRef, useEffect } from "react";
import { RefreshCw, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/data";
import { generateFollowup, sendFollowupEmail } from "@/hooks/useSupabaseData";
import { getDefaultDraft } from "./DraftTemplates";

type Tone = "Polite" | "Friendly" | "Firm" | "Urgent";
const TONES: Tone[] = ["Polite", "Friendly", "Firm", "Urgent"];

export default function AIDraftComposer({ invoice }: { invoice: Invoice }) {
  const [tone, setTone] = useState<Tone>("Friendly");
  const [currentSubject, setCurrentSubject] = useState("");
  const [currentDraft, setCurrentDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const draftRef = useRef<HTMLDivElement>(null);

  // Load default template on mount and tone change
  useEffect(() => {
    const def = getDefaultDraft(invoice, tone);
    setCurrentSubject(def.subject);
    setCurrentDraft(def.message);
    setIsAiGenerated(false);
  }, [tone, invoice]);

  async function handleGenerate() {
    setIsGenerating(true);
    const result = await generateFollowup(invoice, tone);
    if (result) {
      setCurrentDraft(result.message);
      setCurrentSubject(result.subject);
      setIsAiGenerated(true);
    }
    setIsGenerating(false);
    // Scroll to draft
    setTimeout(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }

  function handleToneChange(t: Tone) {
    setTone(t);
  }

  async function handleSend() {
    if (!currentDraft) {
      toast.error("No draft to send");
      return;
    }
    setSending(true);
    const success = await sendFollowupEmail(
      invoice.clientEmail,
      currentSubject || `Follow-up: ${invoice.id}`,
      currentDraft
    );
    setSending(false);
    if (success) {
      setSent(true);
      setTimeout(() => setSent(false), 2500);
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
      <div className="flex gap-2 mb-4">
        {TONES.map((t) => (
          <button
            key={t}
            onClick={() => handleToneChange(t)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              tone === t
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

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
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Generating {tone.toLowerCase()} follow-up…</span>
        </div>
      ) : (
        <textarea
          value={currentDraft}
          onChange={(e) => setCurrentDraft(e.target.value)}
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
          onClick={handleSend}
          disabled={sending || !currentDraft}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
            sent
              ? "bg-[hsl(var(--chart-2))] text-primary-foreground"
              : "bg-foreground text-background hover:opacity-90"
          }`}
        >
          {sent ? (
            "Sent ✓"
          ) : sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Send via Gmail
            </>
          )}
        </button>
      </div>
    </div>
  );
}
