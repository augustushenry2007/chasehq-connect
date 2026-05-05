import { useState, useEffect, useRef } from "react";
import MockDevice from "./MockDevice";
import { MockNewInvoice, MockFollowUps, MockAIDraft, MockSentConfirmation } from "./MockScreens";

const FRAMES = [
  { label: "Add invoice", Component: MockNewInvoice },
  { label: "Track it", Component: MockFollowUps },
  { label: "AI drafts it", Component: MockAIDraft },
  { label: "Sent", Component: MockSentConfirmation },
] as const;

const INTERVAL_MS = 3500;

export default function PhoneCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReduced || paused) return;
    timerRef.current = setTimeout(() => {
      setActive((i) => (i + 1) % FRAMES.length);
    }, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, paused, prefersReduced]);

  return (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <MockDevice float>
        <div className="relative h-full w-full">
          {FRAMES.map(({ Component }, i) => (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
                i === active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
              aria-hidden={i !== active}
            >
              <Component />
            </div>
          ))}
        </div>
      </MockDevice>

      {/* Dot / pill indicators */}
      <div className="flex items-center gap-2 mt-4" role="tablist">
        {FRAMES.map((frame, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            aria-label={`Show ${frame.label}`}
            onClick={() => { setActive(i); setPaused(true); }}
            className={`rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              i === active
                ? "w-5 h-2 bg-primary"
                : "w-2 h-2 bg-primary/25 hover:bg-primary/50"
            }`}
          />
        ))}
      </div>

      <p className="mt-2 text-xs text-muted-foreground font-medium transition-all duration-300">
        {FRAMES[active].label}
      </p>
    </div>
  );
}
