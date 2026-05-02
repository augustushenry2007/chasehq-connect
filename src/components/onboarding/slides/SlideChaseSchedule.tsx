const STEPS = [
  { day: "Day 3",  label: "Friendly reminder",  color: "bg-blue-500",   delay: "delay-[0ms]" },
  { day: "Day 7",  label: "Firm reminder",       color: "bg-amber-500",  delay: "delay-[150ms]" },
  { day: "Day 14", label: "Urgent follow-up",    color: "bg-orange-500", delay: "delay-[300ms]" },
  { day: "Day 21", label: "Final notice",        color: "bg-red-500",    delay: "delay-[450ms]" },
];

export function SlideChaseSchedule() {
  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground mb-1">The Chase Schedule</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every invoice gets a follow-up timeline. ChaseHQ notifies you when each step is due — you review, then send.
        </p>
      </div>

      <div className="relative">
        {/* Vertical connector */}
        <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border" />

        <div className="flex flex-col gap-3">
          {STEPS.map((step) => (
            <div key={step.day} className={`flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500 ${step.delay}`}>
              <div className={`w-10 h-10 rounded-full ${step.color} flex items-center justify-center shrink-0 shadow-sm z-10`}>
                <div className="w-3 h-3 rounded-full bg-white/80" />
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex-1">
                <p className="text-xs font-semibold text-muted-foreground">{step.day}</p>
                <p className="text-sm font-medium text-foreground">{step.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground font-medium text-center px-4">
        You can edit, pause, or skip any step on a per-invoice basis.
      </p>
    </div>
  );
}
