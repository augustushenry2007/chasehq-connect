import AppStoreBadge from "./AppStoreBadge";
import MockDevice from "./MockDevice";
import { MockDraft } from "./MockScreens";

export default function Hero() {
  return (
    <section className="relative px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-accent/40 via-accent/15 to-transparent pointer-events-none" />
      <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        <div className="reveal">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-base font-bold text-foreground tracking-tight">ChaseHQ</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.05]">
            Stop chasing.
            <br />
            <span className="text-primary">Start getting paid.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
            Most freelancers aren't bad at business. They're bad at awkward. ChaseHQ writes every follow-up for you — in your tone, on your schedule.
          </p>
          <div className="mt-8 flex flex-col items-start gap-2">
            <AppStoreBadge size="lg" />
            <p className="text-xs text-muted-foreground ml-1">iPhone · Free to start</p>
          </div>
        </div>
        <div className="reveal flex justify-center lg:justify-end">
          <MockDevice float>
            <MockDraft />
          </MockDevice>
        </div>
      </div>
    </section>
  );
}
