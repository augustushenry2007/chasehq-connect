import MockDevice from "./MockDevice";
import { MockAddInvoice, MockDraft, MockGetPaid } from "./MockScreens";
import { useScrollReveal } from "./useScrollReveal";

const STEPS = [
  {
    n: "01",
    title: "Add an invoice",
    body: "Snap a photo or paste the details. Takes 20 seconds.",
    Frame: MockAddInvoice,
  },
  {
    n: "02",
    title: "ChaseHQ drafts the follow-ups",
    body: "Warm, professional, or direct. Your call. We learn your voice.",
    Frame: MockDraft,
  },
  {
    n: "03",
    title: "You get paid",
    body: "Without a single awkward conversation.",
    Frame: MockGetPaid,
  },
];

export default function HowItWorks() {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <section className="px-6 py-20 sm:py-28">
      <div ref={ref} className="reveal max-w-6xl mx-auto">
        <div className="text-center mb-14 sm:mb-16">
          <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Three steps. That's it.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {STEPS.map(({ n, title, body, Frame }) => (
            <div key={n} className="flex flex-col items-center text-center">
              <MockDevice className="mb-7 scale-90 sm:scale-100">
                <Frame />
              </MockDevice>
              <p className="text-xs font-semibold text-primary mb-2 tracking-wider">{n}</p>
              <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
