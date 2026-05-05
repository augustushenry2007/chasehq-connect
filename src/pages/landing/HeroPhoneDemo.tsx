import { useEffect, useRef, useState } from "react";

type DemoState =
  | "new-invoice"
  | "followups"
  | "ai-draft"
  | "ai-generating"
  | "ai-ready"
  | "send-confirm"
  | "success";

const STATES: DemoState[] = [
  "new-invoice",
  "followups",
  "ai-draft",
  "ai-generating",
  "ai-ready",
  "send-confirm",
  "success",
];

const DURATIONS: Record<DemoState, number> = {
  "new-invoice": 2500,
  followups: 2000,
  "ai-draft": 2500,
  "ai-generating": 2000,
  "ai-ready": 2000,
  "send-confirm": 1500,
  success: 2500,
};

const TRANSITION_MS = 350;

function Screen1NewInvoice() {
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA]">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#E8EEF2]">
        <span className="text-[16px] font-bold text-[#1A2B35]">New Invoice</span>
        <button className="text-[13px] font-semibold text-primary">Save</button>
      </div>
      <div className="flex-1 px-5 py-4 flex flex-col gap-3 overflow-hidden">
        <Field label="Client name" value="Apex Digital" />
        <Field label="Email" value="kate@apexdigital.co" />
        <Field label="Description" value="Brand identity & logo system" />
        <div className="flex gap-3">
          <div className="flex-1">
            <Field label="Amount" value="$4,800" />
          </div>
          <div className="flex-1">
            <Field label="Due date" value="06/15/2025" />
          </div>
        </div>
        <Field label="Invoice ID (optional)" value="INV-012" muted />
        <div className="mt-auto pt-2">
          <button className="w-full bg-primary text-white rounded-[11px] py-3 text-[14px] font-semibold">
            Create Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B8899] uppercase tracking-wide mb-1">{label}</p>
      <div className="bg-white rounded-[9px] px-3 py-2.5 border border-[#E2EBF0]">
        <span className={`text-[13px] ${muted ? "text-[#8FA5B4]" : "text-[#1A2B35] font-medium"}`}>{value}</span>
      </div>
    </div>
  );
}

function Screen2FollowUps() {
  const rows = [
    { name: "Apex Digital", inv: "INV-012", badge: "Overdue +8d", badgeColor: "#EF4444", badgeBg: "rgba(239,68,68,0.10)", amt: "$4,800", highlight: true },
    { name: "Northwind Studio", inv: "INV-009", badge: "Upcoming", badgeColor: "#F59E0B", badgeBg: "rgba(245,158,11,0.10)", amt: "$1,850", highlight: false },
    { name: "Globex Corp", inv: "INV-007", badge: "Paid", badgeColor: "#22C55E", badgeBg: "rgba(34,197,94,0.10)", amt: "$2,300", highlight: false },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F7F9FA]">
      <div className="px-5 pt-4 pb-3">
        <span className="text-[16px] font-bold text-[#1A2B35]">Follow-Ups</span>
        <div className="mt-3 flex items-center gap-2 bg-white rounded-[9px] px-3 py-2 border border-[#E2EBF0]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8FA5B4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span className="text-[12px] text-[#8FA5B4]">Search invoices…</span>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {["All", "Overdue", "Upcoming", "Paid"].map((t) => (
            <span key={t} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${t === "All" ? "bg-primary text-white" : "bg-white text-[#6B8899] border border-[#E2EBF0]"}`}>{t}</span>
          ))}
        </div>
      </div>
      <div className="flex-1 px-5 flex flex-col gap-2 overflow-hidden">
        {rows.map((r) => (
          <div key={r.inv} className={`bg-white rounded-[12px] px-4 py-3 flex items-center gap-3 border ${r.highlight ? "border-primary/30 bg-accent/5" : "border-transparent"}`} style={{ boxShadow: "0 1px 3px rgba(26,43,53,0.05)" }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-semibold text-[#1A2B35] truncate">{r.name}</span>
                <span className="text-[10px] text-[#8FA5B4] shrink-0">{r.inv}</span>
              </div>
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: r.badgeColor, background: r.badgeBg }}>{r.badge}</span>
            </div>
            <span className="text-[13px] font-bold text-[#1A2B35] shrink-0">{r.amt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Screen3AIDraft() {
  const tones = ["Friendly", "Firm", "Urgent", "Final Notice"];
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA]">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-[#E8EEF2]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#447F98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.06l-4.91 3.57a1 1 0 0 0-.36 1.12L17.5 20l-4.91-3.56a1 1 0 0 0-1.18 0L6.5 20l1.88-5.86a1 1 0 0 0-.36-1.12L3.11 9.45h6.06a1 1 0 0 0 .95-.69L12 3z"/></svg>
        <span className="text-[14px] font-bold text-[#1A2B35]">AI Follow-up Draft</span>
      </div>
      <div className="flex-1 px-5 py-3 flex flex-col gap-3 overflow-hidden">
        <div>
          <p className="text-[11px] font-semibold text-[#6B8899] uppercase tracking-wide mb-2">Tone</p>
          <div className="flex flex-wrap gap-1.5">
            {tones.map((t) => (
              <span key={t} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border ${t === "Friendly" ? "bg-primary text-white border-primary" : "bg-white text-[#6B8899] border-[#E2EBF0]"}`}>{t}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-[#6B8899] uppercase tracking-wide mb-1.5">Subject</p>
          <div className="bg-white rounded-[9px] px-3 py-2.5 border border-[#E2EBF0]">
            <span className="text-[12px] text-[#1A2B35]">Quick nudge — INV-012</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <p className="text-[11px] font-semibold text-[#6B8899] uppercase tracking-wide mb-1.5">Message</p>
          <div className="bg-white rounded-[9px] px-3 py-2.5 border border-[#E2EBF0] h-full max-h-[110px] overflow-hidden">
            <p className="text-[12px] leading-[1.55] text-[#1A2B35]">Hey Kate,{"\n\n"}Wanted to check in on INV-012 ($4,800) — it was due a little while ago. Let me know if anything came up!</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <span className="flex-1 text-[11px] text-[#8FA5B4]">Template 1/5</span>
          <button className="flex items-center gap-1.5 bg-primary text-white rounded-[9px] px-3 py-2.5 text-[12px] font-semibold">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.06l-4.91 3.57a1 1 0 0 0-.36 1.12L17.5 20l-4.91-3.56a1 1 0 0 0-1.18 0L6.5 20l1.88-5.86a1 1 0 0 0-.36-1.12L3.11 9.45h6.06a1 1 0 0 0 .95-.69L12 3z"/></svg>
            Generate with AI
          </button>
        </div>
      </div>
    </div>
  );
}

function Screen4AIGenerating() {
  const tones = ["Friendly", "Firm", "Urgent", "Final Notice"];
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA]">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-[#E8EEF2]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#447F98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.06l-4.91 3.57a1 1 0 0 0-.36 1.12L17.5 20l-4.91-3.56a1 1 0 0 0-1.18 0L6.5 20l1.88-5.86a1 1 0 0 0-.36-1.12L3.11 9.45h6.06a1 1 0 0 0 .95-.69L12 3z"/></svg>
        <span className="text-[14px] font-bold text-[#1A2B35]">AI Follow-up Draft</span>
      </div>
      <div className="flex-1 px-5 py-3 flex flex-col gap-3 overflow-hidden">
        <div>
          <p className="text-[11px] font-semibold text-[#6B8899] uppercase tracking-wide mb-2">Tone</p>
          <div className="flex flex-wrap gap-1.5">
            {tones.map((t) => (
              <span key={t} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border ${t === "Friendly" ? "bg-primary text-white border-primary" : "bg-white text-[#6B8899] border-[#E2EBF0]"}`}>{t}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-[#6B8899] uppercase tracking-wide mb-1.5">Subject</p>
          <div className="bg-white rounded-[9px] px-3 py-2.5 border border-[#E2EBF0]">
            <span className="text-[12px] text-[#1A2B35]">Quick nudge — INV-012</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <p className="text-[11px] font-semibold text-[#6B8899] uppercase tracking-wide mb-1.5">Message</p>
          <div className="bg-white rounded-[9px] px-3 py-2.5 border border-[#E2EBF0] h-full max-h-[110px] overflow-hidden flex flex-col justify-center">
            <div className="space-y-1.5">
              {[100, 80, 100, 65, 100, 85].map((w, i) => (
                <div key={i} style={{ width: `${w}%` }} className="h-2 bg-[#E2EBF0] rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#447F98" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span className="text-[12px] text-[#6B8899]">Generating friendly follow-up…</span>
        </div>
      </div>
    </div>
  );
}

function Screen5AIDraftReady() {
  const tones = ["Friendly", "Firm", "Urgent", "Final Notice"];
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA]">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#E8EEF2]">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#447F98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.06l-4.91 3.57a1 1 0 0 0-.36 1.12L17.5 20l-4.91-3.56a1 1 0 0 0-1.18 0L6.5 20l1.88-5.86a1 1 0 0 0-.36-1.12L3.11 9.45h6.06a1 1 0 0 0 .95-.69L12 3z"/></svg>
          <span className="text-[14px] font-bold text-[#1A2B35]">AI Follow-up Draft</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#16A34A" }}>AI Generated</span>
      </div>
      <div className="flex-1 px-5 py-3 flex flex-col gap-3 overflow-hidden">
        <div>
          <div className="flex flex-wrap gap-1.5">
            {tones.map((t) => (
              <span key={t} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border ${t === "Friendly" ? "bg-primary text-white border-primary" : "bg-white text-[#6B8899] border-[#E2EBF0]"}`}>{t}</span>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <div className="bg-white rounded-[9px] px-3 py-2.5 border border-[#E2EBF0] h-full max-h-[130px] overflow-hidden">
            <p className="text-[12px] leading-[1.55] text-[#1A2B35]">Hey Kate,{"\n\n"}Hope things are going well! Just a friendly nudge on invoice #INV-012 for $4,800 — it slipped past the due date. No worries at all, just wanted to make sure it didn't get buried. Let me know if you need anything from me!</p>
          </div>
        </div>
        <button className="w-full bg-primary text-white rounded-[11px] py-3 text-[13px] font-semibold mt-auto">
          Send Follow-Up →
        </button>
      </div>
    </div>
  );
}

function Screen6SendConfirm() {
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA] relative overflow-hidden">
      {/* Background composer (dimmed) */}
      <div className="absolute inset-0 opacity-30">
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-[#E8EEF2]">
          <span className="text-[14px] font-bold text-[#1A2B35]">AI Follow-up Draft</span>
        </div>
        <div className="px-5 py-4">
          <div className="space-y-2">
            {[90, 70, 90, 60].map((w, i) => (
              <div key={i} style={{ width: `${w}%` }} className="h-2 bg-[#CBD5DC] rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[22px] px-5 pt-4 pb-6 flex flex-col gap-3"
        style={{ boxShadow: "0 -8px 40px rgba(26,43,53,0.14)" }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-[#D1DCE3] rounded-full mx-auto mb-1" />
        <div>
          <p className="text-[15px] font-bold text-[#1A2B35] mb-0.5">Send to Apex Digital?</p>
          <p className="text-[12px] text-[#6B8899]">To: kate@apexdigital.co</p>
        </div>
        <div className="bg-[#F7F9FA] rounded-[9px] px-3 py-2 border border-[#E2EBF0]">
          <p className="text-[11px] text-[#6B8899] mb-0.5">Subject</p>
          <p className="text-[12px] font-medium text-[#1A2B35]">Quick nudge — INV-012</p>
        </div>
        <div className="bg-[#F7F9FA] rounded-[9px] px-3 py-2 border border-[#E2EBF0]">
          <p className="text-[12px] text-[#6B8899] leading-[1.45] line-clamp-2">Hey Kate, Hope things are going well! Just a friendly nudge on invoice #INV-012…</p>
        </div>
        <button className="w-full bg-primary text-white rounded-[11px] py-3 text-[13px] font-semibold">
          Send message
        </button>
        <button className="text-[12px] text-[#6B8899] font-medium text-center">Edit draft</button>
      </div>
    </div>
  );
}

function Screen7Success() {
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA]">
      {/* Success hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.12)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l5 5L20 7" /></svg>
        </div>
        <p className="text-[15px] font-bold text-[#1A2B35]">Follow-up sent.</p>
        <p className="text-[12px] text-[#6B8899] text-center">Apex Digital · INV-012 · Friendly tone</p>
      </div>

      {/* Updated list preview */}
      <div className="px-5 pb-5 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-[#6B8899] uppercase tracking-wide mb-1">Your follow-ups</p>
        {[
          { name: "Apex Digital", inv: "INV-012", badge: "Follow-up sent", badgeColor: "#D97706", badgeBg: "rgba(217,119,6,0.10)", amt: "$4,800" },
          { name: "Northwind Studio", inv: "INV-009", badge: "Upcoming", badgeColor: "#F59E0B", badgeBg: "rgba(245,158,11,0.10)", amt: "$1,850" },
        ].map((r) => (
          <div key={r.inv} className="bg-white rounded-[12px] px-4 py-3 flex items-center gap-3 border border-transparent" style={{ boxShadow: "0 1px 3px rgba(26,43,53,0.05)" }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-semibold text-[#1A2B35] truncate">{r.name}</span>
                <span className="text-[10px] text-[#8FA5B4] shrink-0">{r.inv}</span>
              </div>
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: r.badgeColor, background: r.badgeBg }}>{r.badge}</span>
            </div>
            <span className="text-[13px] font-bold text-[#1A2B35] shrink-0">{r.amt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SCREENS: Record<DemoState, () => JSX.Element> = {
  "new-invoice": Screen1NewInvoice,
  followups: Screen2FollowUps,
  "ai-draft": Screen3AIDraft,
  "ai-generating": Screen4AIGenerating,
  "ai-ready": Screen5AIDraftReady,
  "send-confirm": Screen6SendConfirm,
  success: Screen7Success,
};

export default function HeroPhoneDemo() {
  const [current, setCurrent] = useState<DemoState>("new-invoice");
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion.current) {
      setCurrent("ai-draft");
      return;
    }

    let idx = 0;

    function advance() {
      setVisible(false);
      timerRef.current = setTimeout(() => {
        idx = (idx + 1) % STATES.length;
        const next = STATES[idx];
        setCurrent(next);
        setVisible(true);
        timerRef.current = setTimeout(advance, DURATIONS[next]);
      }, TRANSITION_MS);
    }

    timerRef.current = setTimeout(advance, DURATIONS[STATES[0]]);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const ScreenComponent = SCREENS[current];

  return (
    <div
      className="w-full h-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
      }}
    >
      <ScreenComponent />
    </div>
  );
}
