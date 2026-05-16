import { useEffect, useRef, useState } from "react";

import welcomeImg from "@/assets/landing/screens/welcome.png";
import scheduleImg from "@/assets/landing/screens/chase-schedule.png";
import generateAiImg from "@/assets/landing/screens/generate-ai.png";
import invoiceDetailImg from "@/assets/landing/screens/invoice-detail.png";

type DemoState =
  | "welcome"
  | "followups"
  | "schedule"
  | "generate-ai"
  | "invoice-detail"
  | "send-confirm"
  | "dashboard";

const STATES: DemoState[] = [
  "welcome",
  "followups",
  "schedule",
  "generate-ai",
  "invoice-detail",
  "send-confirm",
  "dashboard",
];

const DURATIONS: Record<DemoState, number> = {
  welcome: 2800,
  followups: 2400,
  schedule: 3000,
  "generate-ai": 3200,
  "invoice-detail": 3000,
  "send-confirm": 2200,
  dashboard: 3000,
};

const TRANSITION_MS = 350;

const HERO = {
  client: "Apex Digital",
  email: "kate@apexdigital.co",
} as const;

type StatusKey = "Escalated" | "Overdue" | "Upcoming" | "Paid";
const BADGE: Record<StatusKey, { bg: string; text: string; dot: string }> = {
  Escalated: { bg: "#FEE2E2", text: "#DC2626", dot: "#DC2626" },
  Overdue:   { bg: "#FEF3C7", text: "#D97706", dot: "#F59E0B" },
  Upcoming:  { bg: "#DBEAFE", text: "#2563EB", dot: "#3B82F6" },
  Paid:      { bg: "#DCFCE7", text: "#16A34A", dot: "#22C55E" },
};

type Row = {
  initial: string;
  name: string;
  inv: string;
  amt: string;
  late: number;
  inDays?: number;
  status: StatusKey;
  highlight?: boolean;
};

const ROSTER: Row[] = [
  { initial: "F", name: "Foxwell Media",   inv: "INV-001", amt: "$3,200", late: 31, status: "Escalated" },
  { initial: "M", name: "Meridian Studio", inv: "INV-004", amt: "$4,800", late: 14, status: "Overdue"   },
  { initial: "P", name: "Peak Digital",    inv: "INV-006", amt: "$2,200", late:  7, status: "Overdue"   },
  { initial: "A", name: "Apex Digital",    inv: "INV-012", amt: "$4,800", late:  8, status: "Overdue", highlight: true },
  { initial: "J", name: "Juniper Labs",    inv: "INV-008", amt: "$2,750", late:  0, inDays: 3, status: "Upcoming" },
];

function StatusPill({ status }: { status: StatusKey }) {
  const s = BADGE[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: s.dot }} />
      {status}
    </span>
  );
}

function Avatar({ initial }: { initial: string }) {
  return (
    <span className="w-8 h-8 rounded-full bg-accent/60 text-primary inline-flex items-center justify-center text-[12px] font-bold shrink-0">
      {initial}
    </span>
  );
}

function ScreenImg({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover object-top select-none pointer-events-none"
      draggable={false}
    />
  );
}

function Screen2FollowUps() {
  const tabs: { label: string; count: number; active?: boolean }[] = [
    { label: "All", count: 8, active: true },
    { label: "Overdue", count: 3 },
    { label: "Upcoming", count: 2 },
    { label: "Paid", count: 2 },
  ];
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA]">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[16px] font-bold text-[#1A2B35] leading-tight">Follow-Ups</p>
        <p className="text-[10px] text-[#6B8899] mt-0.5">Every follow-up, every client — in one place.</p>
      </div>
      <div className="px-5 pb-2">
        <div className="flex items-center gap-2 bg-white rounded-[10px] px-3 py-2 border border-[#E2EBF0]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8FA5B4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span className="text-[11px] text-[#8FA5B4]">Search invoices…</span>
        </div>
      </div>
      <div className="px-5 flex items-end gap-3 border-b border-[#E8EEF2] pb-2">
        {tabs.map((t) => (
          <span
            key={t.label}
            className={`flex items-center gap-1 text-[11px] font-semibold pb-1 ${
              t.active ? "text-primary border-b-2 border-primary -mb-2" : "text-[#6B8899]"
            }`}
          >
            {t.label}
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                t.active ? "bg-primary text-white" : "bg-[#E8EEF2] text-[#6B8899]"
              }`}
            >
              {t.count}
            </span>
          </span>
        ))}
      </div>
      <div className="flex-1 px-5 pt-2.5 flex flex-col gap-2 overflow-hidden">
        {ROSTER.map((r) => (
          <div
            key={r.inv}
            className={`bg-white rounded-[12px] px-3 py-2.5 flex items-center gap-3 border ${
              r.highlight ? "border-primary/35" : "border-transparent"
            }`}
            style={{ boxShadow: "0 1px 3px rgba(26,43,53,0.05)" }}
          >
            <Avatar initial={r.initial} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[12px] font-semibold text-[#1A2B35] truncate">{r.name}</span>
                <span className="text-[10px] text-[#8FA5B4] shrink-0">· {r.inv}</span>
              </div>
              <span className="text-[10px] text-[#6B8899]">
                {r.amt} ·{" "}
                {r.status === "Upcoming"
                  ? `in ${r.inDays ?? 0} days`
                  : `${r.late} days late`}
              </span>
            </div>
            <StatusPill status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Screen6SendConfirm() {
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA] relative overflow-hidden">
      {/* Dimmed composer behind */}
      <div className="absolute inset-0 opacity-25">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#E8EEF2]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#447F98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.88 5.76a1 1 0 0 0 .95.69h6.06l-4.91 3.57a1 1 0 0 0-.36 1.12L17.5 20l-4.91-3.56a1 1 0 0 0-1.18 0L6.5 20l1.88-5.86a1 1 0 0 0-.36-1.12L3.11 9.45h6.06a1 1 0 0 0 .95-.69L12 3z"/>
            </svg>
            <span className="text-[13px] font-bold text-[#1A2B35]">AI Follow-up Draft</span>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2">
          <div className="flex gap-1.5">
            {["Friendly", "Firm", "Urgent", "Final Notice"].map((t) => (
              <span key={t} className={`text-[11px] px-2.5 py-1 rounded-full border ${t === "Friendly" ? "bg-primary/40 text-white border-primary/40" : "bg-white text-[#6B8899] border-[#E2EBF0]"}`}>{t}</span>
            ))}
          </div>
          <div className="space-y-1.5 pt-2">
            {[90, 70, 90, 60].map((w, i) => (
              <div key={i} style={{ width: `${w}%` }} className="h-2 bg-[#CBD5DC] rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* Backdrop tint */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[22px] px-5 pt-3 pb-5 flex flex-col gap-2.5"
        style={{ boxShadow: "0 -8px 40px rgba(26,43,53,0.18)" }}
      >
        <div className="w-9 h-1 bg-[#D1DCE3] rounded-full mx-auto mb-1" />
        <div>
          <p className="text-[15px] font-bold text-[#1A2B35] leading-tight">Your first follow-up is on us</p>
          <p className="text-[10px] text-[#6B8899] mt-1 leading-snug">
            Sending to {HERO.email} · your next follow-up starts your free trial
          </p>
        </div>
        <div className="bg-[#F4F7F9] rounded-[9px] px-3 py-2 border border-[#E2EBF0]">
          <p className="text-[9px] font-semibold text-[#6B8899] uppercase tracking-wide mb-0.5">Subject</p>
          <p className="text-[11px] font-medium text-[#1A2B35]">Friendly reminder: Invoice 012 for {HERO.client}</p>
        </div>
        <div className="bg-[#F4F7F9] rounded-[9px] px-3 py-2 border border-[#E2EBF0]">
          <p className="text-[11px] text-[#1A2B35] leading-[1.4]">Dear {HERO.client} team,</p>
          <p className="text-[10px] text-[#6B8899] leading-[1.45] mt-1">
            I hope you're having a great week!{"\n"}I'm just sending a quick note about invoice 012…
          </p>
          <p className="text-[10px] text-primary font-semibold mt-1">▾ Show full message</p>
        </div>
        <button className="w-full bg-primary text-white rounded-[11px] py-3 text-[13px] font-semibold inline-flex items-center justify-center gap-2 mt-1">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
          Send message
        </button>
        <button className="text-[11px] text-[#6B8899] font-medium text-center">Edit draft</button>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  iconBg,
  iconColor,
  valueColor,
  Icon,
  topBorder,
}: {
  label: string;
  value: string;
  sub: string;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  topBorder: string;
  Icon: () => React.ReactElement;
}) {
  return (
    <div
      className="bg-white rounded-[12px] p-2.5 flex flex-col"
      style={{ borderTop: `2px solid ${topBorder}`, boxShadow: "0 1px 3px rgba(26,43,53,0.05)" }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-5 h-5 rounded-md inline-flex items-center justify-center shrink-0"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon />
        </span>
        <span className="text-[10px] font-medium text-[#6B8899]">{label}</span>
      </div>
      <p className="text-[16px] font-bold tracking-[-0.02em]" style={{ color: valueColor ?? "#1A2B35" }}>
        {value}
      </p>
      <p className="text-[9px] text-[#6B8899] mt-0.5">{sub}</p>
    </div>
  );
}

function Screen7Dashboard() {
  const feed = ROSTER.filter((r) => r.status === "Escalated" || r.status === "Overdue").slice(0, 3);
  return (
    <div className="flex flex-col h-full bg-[#F7F9FA]">
      <div className="px-5 pt-4 pb-2 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#1A2B35] leading-tight">Good Evening, Alex</p>
          <p className="text-[10px] text-[#6B8899] mt-0.5">Here's what needs your attention today.</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A2B35" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
      </div>

      <div className="px-5 grid grid-cols-2 gap-2 mt-1">
        <KpiTile
          label="Outstanding"
          value="$15,700"
          sub="6 invoices"
          iconBg="hsl(190 25% 90%)"
          iconColor="#447F98"
          topBorder="hsl(190 30% 45% / 0.45)"
          Icon={() => (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>
          )}
        />
        <KpiTile
          label="Overdue"
          value="$10,200"
          sub="3 need action"
          iconBg="#FED7AA"
          iconColor="#C2410C"
          valueColor="#DC2626"
          topBorder="hsl(28 90% 60% / 0.45)"
          Icon={() => (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          )}
        />
        <KpiTile
          label="Total Collected"
          value="$17,700"
          sub="2 invoices paid"
          iconBg="#DCFCE7"
          iconColor="#15803D"
          valueColor="#16A34A"
          topBorder="hsl(142 70% 45% / 0.40)"
          Icon={() => (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          )}
        />
        <KpiTile
          label="Upcoming"
          value="$2,750"
          sub="2 invoices"
          iconBg="#E8EEF2"
          iconColor="#6B8899"
          topBorder="hsl(0 0% 80%)"
          Icon={() => (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          )}
        />
      </div>

      <div className="px-5 mt-3 flex-1 min-h-0">
        <div className="bg-white rounded-[12px] p-3 h-full flex flex-col" style={{ boxShadow: "0 1px 3px rgba(26,43,53,0.05)" }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[12px] font-bold text-[#1A2B35] leading-tight">Chase Feed</p>
              <p className="text-[9px] text-[#6B8899] mt-0.5">Prioritized actions</p>
            </div>
            <span className="text-[10px] font-semibold text-primary">View all</span>
          </div>
          <div className="flex flex-col gap-1.5 overflow-hidden">
            {feed.map((r) => (
              <div key={r.inv} className="flex items-center gap-2.5 py-1">
                <Avatar initial={r.initial} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[11px] font-semibold text-[#1A2B35] truncate">{r.name}</span>
                    <span className="text-[9px] text-[#8FA5B4] shrink-0">· {r.inv}</span>
                  </div>
                  <span className="text-[9px] text-[#6B8899]">{r.amt} · {r.late} days late</span>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <div className="px-5 pt-2 pb-1 flex items-center justify-around border-t border-[#E8EEF2] bg-white shrink-0 relative">
        <div className="flex flex-col items-center gap-0.5 text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span className="text-[8px] font-semibold">Dashboard</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-[#8FA5B4]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>
          <span className="text-[8px] font-medium">Follow-Ups</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-[#8FA5B4]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.8.3h.1A1.7 1.7 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
          <span className="text-[8px] font-medium">Settings</span>
        </div>
        {/* FAB above tab bar */}
        <div className="absolute right-4 -top-5 w-9 h-9 rounded-full bg-primary text-white inline-flex items-center justify-center" style={{ boxShadow: "0 4px 12px rgba(68,127,152,0.40)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
      </div>
    </div>
  );
}

const SCREENS: Record<DemoState, () => JSX.Element> = {
  welcome:          () => <ScreenImg src={welcomeImg}        alt="ChaseHQ welcome — Stop chasing, start getting paid" />,
  followups:        Screen2FollowUps,
  schedule:         () => <ScreenImg src={scheduleImg}       alt="The Chase Schedule — Day 3, 7, 14, 21 timeline" />,
  "generate-ai":    () => <ScreenImg src={generateAiImg}     alt="Generate with AI — real follow-up draft preview" />,
  "invoice-detail": () => <ScreenImg src={invoiceDetailImg}  alt="Invoice detail — Apex Digital with Chase Schedule" />,
  "send-confirm":   Screen6SendConfirm,
  dashboard:        Screen7Dashboard,
};

export default function HeroPhoneDemo() {
  const [current, setCurrent] = useState<DemoState>("welcome");
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion.current) {
      setCurrent("generate-ai");
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
