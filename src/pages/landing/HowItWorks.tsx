import { useScrollReveal } from "./useScrollReveal";

const STEPS = [
  {
    n: "01",
    title: "Add an invoice",
    body: "Fill in a few fields and save. Done in seconds.",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "ChaseHQ drafts the follow-ups",
    body: "Friendly, Firm, Urgent, or Final Notice. AI picks the right tone, you approve.",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
        <path d="M19 14l.7 1.9L21.5 17l-1.8.7L19 19.5l-.7-1.8L16.5 17l1.8-.7L19 14z" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "You get paid",
    body: "Without a single awkward conversation.",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const headRef = useScrollReveal<HTMLDivElement>();
  return (
    <section className="px-6 py-28 sm:py-32 bg-gradient-to-b from-muted/50 to-transparent">
      <div className="max-w-6xl mx-auto">
        <div ref={headRef} className="reveal text-center max-w-[620px] mx-auto mb-16">
          <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-3">How it works</p>
          <h2 className="text-[clamp(32px,4vw,44px)] font-bold text-foreground tracking-tight leading-[1.08] mb-4">
            Three steps. No awkward.
          </h2>
          <p className="text-[17px] text-muted-foreground leading-[1.55]">
            From "I really should send that follow-up…" to a paid invoice, without the part you hate.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_40px_1fr_40px_1fr] items-start gap-y-7">
          <StepCard n={STEPS[0].n} title={STEPS[0].title} body={STEPS[0].body} Icon={STEPS[0].Icon} />
          <div className="hidden md:flex items-center justify-center pt-20 text-primary/35">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </div>
          <StepCard n={STEPS[1].n} title={STEPS[1].title} body={STEPS[1].body} Icon={STEPS[1].Icon} />
          <div className="hidden md:flex items-center justify-center pt-20 text-primary/35">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </div>
          <StepCard n={STEPS[2].n} title={STEPS[2].title} body={STEPS[2].body} Icon={STEPS[2].Icon} />
        </div>
      </div>
    </section>
  );
}

function StepCard({ n, title, body, Icon }: { n: string; title: string; body: string; Icon: () => React.ReactElement }) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal bg-card rounded-3xl border border-border p-8 relative" style={{ boxShadow: "0 2px 12px rgba(26,43,53,0.08)", borderTop: "2px solid hsl(var(--primary)/0.35)" }}>
      <div className="text-[52px] font-bold text-primary/20 tracking-[-0.04em] leading-none mb-6">{n}</div>
      <div className="w-11 h-11 bg-accent/60 text-primary rounded-xl inline-flex items-center justify-center mb-4">
        <Icon />
      </div>
      <h4 className="text-[18px] font-semibold text-foreground tracking-tight mb-2">{title}</h4>
      <p className="text-[15px] text-muted-foreground leading-[1.55]">{body}</p>
    </div>
  );
}
