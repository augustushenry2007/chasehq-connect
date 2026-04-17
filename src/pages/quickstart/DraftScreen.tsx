import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import QuickstartLayout from "./QuickstartLayout";
import TypingMessage from "@/components/quickstart/TypingMessage";
import GmailConnectSheet from "@/components/quickstart/GmailConnectSheet";
import { useApp } from "@/context/AppContext";
import { generateFollowup, sendFollowupEmail } from "@/hooks/useSupabaseData";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useSendingMailbox } from "@/hooks/useSendingMailbox";
import { getDefaultDraft, type Tone } from "@/components/invoice/DraftTemplates";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/data";

const TONE_CHIPS: Tone[] = ["Friendly", "Polite", "Firm"];

export default function DraftScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, invoices, refetchInvoices } = useApp();
  const { canSend } = useSendingMailbox();
  const { gmail } = useGmailConnection();

  const invoiceNumber = params.get("invoice") || "";
  const invoice = useMemo(() => invoices.find((i) => i.id === invoiceNumber), [invoices, invoiceNumber]);

  const [tone, setTone] = useState<Tone>("Friendly");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(true);
  const [hasTyped, setHasTyped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Generate first draft on mount
  useEffect(() => {
    if (!invoice) return;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      const ai = await generateFollowup(invoice, tone);
      if (cancelled) return;
      if (ai) {
        setSubject(ai.subject);
        setMessage(ai.message);
      } else {
        const def = getDefaultDraft(invoice, tone);
        setSubject(def.subject);
        setMessage(def.message);
      }
      setGenerating(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  async function regenerateForTone(newTone: Tone) {
    if (!invoice) return;
    setTone(newTone);
    setHasTyped(true); // skip typing animation on subsequent drafts
    const def = getDefaultDraft(invoice, newTone);
    setSubject(def.subject);
    setMessage(def.message);
  }

  async function handleSend() {
    if (!invoice) return;
    if (!canSend) {
      setSheetOpen(true);
      return;
    }
    setSending(true);
    const ok = await sendFollowupEmail(invoice.clientEmail, subject || `Following up: ${invoice.id}`, message);
    if (ok && user) {
      await supabase.from("followups").insert({
        user_id: user.id,
        invoice_id: (await supabase.from("invoices").select("id").eq("invoice_number", invoice.id).maybeSingle()).data?.id || "",
        tone,
        subject,
        message,
        is_ai_generated: true,
        sent_at: new Date().toISOString(),
      });
      await refetchInvoices();
      navigate("/quickstart/sent");
    }
    setSending(false);
  }

  if (!invoice) {
    return (
      <QuickstartLayout step={4}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </QuickstartLayout>
    );
  }

  return (
    <QuickstartLayout step={4} showBack onBack={() => navigate("/quickstart/invoice")}>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          Here's your follow-up
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Written for {invoice.client}. Tweak the tone or send as-is.
        </p>

        {/* Tone chips */}
        <div className="flex gap-2 mt-5">
          {TONE_CHIPS.map((t) => (
            <button
              key={t}
              onClick={() => regenerateForTone(t)}
              disabled={generating}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                tone === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {t === "Friendly" ? "Friendly nudge" : t === "Polite" ? "Polite reminder" : "Firm ask"}
            </button>
          ))}
        </div>

        {/* Draft card */}
        <div className="mt-4 bg-card border border-border rounded-2xl p-4 min-h-[260px]">
          {generating ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Writing your message…</span>
            </div>
          ) : editing ? (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="w-full bg-transparent text-sm text-foreground resize-none focus:outline-none leading-relaxed"
            />
          ) : (
            <div onClick={() => setEditing(true)} className="cursor-text">
              <p className="text-xs text-muted-foreground mb-2">Subject: {subject}</p>
              {hasTyped ? (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{message}</p>
              ) : (
                <TypingMessage
                  text={message}
                  className="text-sm text-foreground leading-relaxed"
                  onDone={() => setHasTyped(true)}
                />
              )}
            </div>
          )}
        </div>

        {/* Schedule hint */}
        <div className="mt-3 flex items-start gap-2 px-1">
          <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            If no reply, we'll follow up again in 3 days — slightly firmer.
          </p>
        </div>
      </div>

      <button
        onClick={handleSend}
        disabled={generating || sending || !message}
        className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-base font-semibold mt-6 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {sending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
        ) : canSend ? (
          <><Send className="w-4 h-4" /> Send via {gmail.email ? "Gmail" : "email"}</>
        ) : (
          <><Mail className="w-4 h-4" /> Send via Gmail</>
        )}
      </button>

      <GmailConnectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        redirectPath={`/quickstart/draft?invoice=${invoiceNumber}`}
      />
    </QuickstartLayout>
  );
}
