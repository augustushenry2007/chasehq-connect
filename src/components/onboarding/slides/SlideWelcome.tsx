import appLogo from "@/assets/app-logo.png";

export function SlideWelcome() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-2">
      <img src={appLogo} alt="ChaseHQ" className="w-20 h-20 rounded-3xl shadow-lg" />

      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Meet ChaseHQ</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
          You set the rules. ChaseHQ handles the awkward part — following up on unpaid invoices so you don't have to.
        </p>
      </div>

      <div className="w-full bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground space-y-2.5">
        {["You add an invoice", "We draft every follow-up in your tone", "You review and send — nothing goes without you"].map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
