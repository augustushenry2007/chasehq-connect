import { useScrollReveal } from "./useScrollReveal";

export default function DreadVsRelief() {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <section className="px-6 py-20 sm:py-24 bg-card/40">
      <div ref={ref} className="reveal max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          <Side
            kicker="Without ChaseHQ"
            heading="Eight unpaid invoices."
            body="Three half-written follow-ups in your drafts. The sinking feeling every time you open Gmail."
            tone="dread"
          />
          <Side
            kicker="With ChaseHQ"
            heading="A calm timeline."
            body="Every follow-up handled. Money in, anxiety out."
            tone="relief"
          />
        </div>
      </div>
    </section>
  );
}

function Side({
  kicker,
  heading,
  body,
  tone,
}: {
  kicker: string;
  heading: string;
  body: string;
  tone: "dread" | "relief";
}) {
  const surface =
    tone === "dread"
      ? "bg-card border-border text-foreground"
      : "bg-gradient-to-br from-primary/15 to-accent/30 border-primary/20 text-foreground";
  const dotClass = tone === "dread" ? "bg-muted-foreground/40" : "bg-primary";
  return (
    <div className={`rounded-3xl border p-7 sm:p-9 ${surface}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{kicker}</p>
      </div>
      <h3 className="text-2xl font-semibold text-foreground leading-tight">{heading}</h3>
      <p className="mt-3 text-base text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
