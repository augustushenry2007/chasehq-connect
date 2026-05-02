import { useState, useEffect } from "react";

const TONES = [
  { name: "Friendly",     subject: "Quick reminder — Invoice #1042",              style: "bg-blue-500 text-white" },
  { name: "Firm",         subject: "Invoice #1042 is now overdue",               style: "bg-amber-500 text-white" },
  { name: "Urgent",       subject: "ACTION REQUIRED — Invoice #1042",            style: "bg-orange-500 text-white" },
  { name: "Final Notice", subject: "Final Notice — Invoice #1042 (14 days late)", style: "bg-red-500 text-white" },
];

export function SlideToneSelector() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % TONES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const tone = TONES[active];

  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground mb-1">Four Built-in Templates</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Four tones for four moments — from friendly nudge to final notice. Tap any to preview.
        </p>
      </div>

      {/* Animated email preview */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-muted/50 px-4 py-2 border-b border-border">
          <p className="text-[11px] text-muted-foreground">To: client@acme.co</p>
          <p
            key={tone.name}
            className="text-sm font-semibold text-foreground mt-0.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-1"
          >
            {tone.subject}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {active === 0 && "Hi Sarah! Just a quick heads-up — Invoice #1042 for $1,200 is now due. No rush, but wanted to make sure it's on your radar…"}
            {active === 1 && "Hi Sarah, Invoice #1042 for $1,200 is now overdue. Could you arrange payment at your earliest convenience?"}
            {active === 2 && "Hi Sarah, Invoice #1042 ($1,200) is now 7 days past due. I need this resolved this week or I may need to pause our work together."}
            {active === 3 && "Hi Sarah, this is my final notice regarding Invoice #1042 ($1,200, now 14 days overdue). Please arrange payment immediately."}
          </p>
        </div>
      </div>

      {/* Tone pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {TONES.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setActive(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${i === active ? t.style : "bg-muted text-muted-foreground"}`}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
