import AppStoreBadge from "./AppStoreBadge";
import { useScrollReveal } from "./useScrollReveal";

export default function FinalCTA() {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <section className="px-6 py-24 sm:py-32 bg-gradient-to-br from-accent/40 via-accent/20 to-transparent">
      <div ref={ref} className="reveal max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight leading-[1.1]">
          Your inbox, finally quiet.
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground">
          Free to start. iPhone only — for now.
        </p>
        <div className="mt-10 flex flex-col items-center gap-2">
          <AppStoreBadge size="lg" />
        </div>
      </div>
    </section>
  );
}
