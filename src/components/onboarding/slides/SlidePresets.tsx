const PRESETS = [
  {
    name: "Active",
    tagline: "Pay attention",
    color: "border-primary bg-primary/5",
    badge: "bg-primary/10 text-primary",
    steps: "Day 3 · 7 · 14 · 21",
    desc: "Friendly → Firm → Urgent → Final Notice",
  },
  {
    name: "Patient",
    tagline: "Steady professional",
    color: "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    steps: "Day 5 · 13 · 20 · 23",
    desc: "Friendly → Friendly → Firm → Final Notice",
  },
  {
    name: "Light",
    tagline: "Relationship-first",
    color: "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    steps: "Day 7 · 14 · 21 · 28",
    desc: "Friendly → Friendly → Firm → Firm",
  },
];

export function SlidePresets() {
  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground mb-1">Scheduling Styles</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Active, Patient, and Light are scheduling philosophies — not status lights. Each sets a different default cadence for new invoices.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {PRESETS.map((p) => (
          <div key={p.name} className={`border-[1.5px] rounded-xl p-3.5 ${p.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${p.badge}`}>{p.name}</span>
              <span className="text-xs font-semibold text-foreground">{p.tagline}</span>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground">{p.steps}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground font-medium text-center">
        You chose your style during setup. Change it anytime in Settings.
      </p>
    </div>
  );
}
