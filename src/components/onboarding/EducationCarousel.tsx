import { useState, useRef } from "react";
import { SlideChaseSchedule } from "./slides/SlideChaseSchedule";
import { SlidePresets } from "./slides/SlidePresets";
import { SlideToneSelector } from "./slides/SlideToneSelector";
import { SlideGenerateAI } from "./slides/SlideGenerateAI";
import { SlideInvoiceAge } from "./slides/SlideInvoiceAge";

const SLIDES = [
  { id: "schedule",  Component: SlideChaseSchedule },
  { id: "presets",   Component: SlidePresets },
  { id: "tone",      Component: SlideToneSelector },
  { id: "ai",        Component: SlideGenerateAI },
  { id: "age",       Component: SlideInvoiceAge },
];

interface Props {
  onDone: () => void;
  onSkip: () => void;
}

export function EducationCarousel({ onDone, onSkip }: Props) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const touchStartX = useRef<number | null>(null);

  const isLast = index === SLIDES.length - 1;
  const { Component } = SLIDES[index];

  function goNext() {
    if (isLast) { onDone(); return; }
    setDir("forward");
    setIndex((i) => i + 1);
  }

  function goBack() {
    if (index === 0) return;
    setDir("back");
    setIndex((i) => i - 1);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      if (delta > 0) goNext();
      else goBack();
    }
    touchStartX.current = null;
  }

  return (
    <div
      className="flex flex-col h-full select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 pt-4 pb-2 shrink-0">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { setDir(i > index ? "forward" : "back"); setIndex(i); }}
            aria-label={`Slide ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${i === index ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30"}`}
          />
        ))}
      </div>

      {/* Slide content */}
      <div
        key={`${index}-${dir}`}
        className="flex-1 overflow-y-auto py-4 px-5 animate-in fade-in slide-in-from-right-4 duration-300"
        style={dir === "back" ? { animationName: "slideInFromLeft" } : undefined}
      >
        <Component />
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 pb-[max(env(safe-area-inset-bottom,16px),24px)] pt-4 border-t border-border flex items-center justify-between gap-3">
        <button
          onClick={onSkip}
          className="min-h-11 px-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip tour
        </button>
        <button
          onClick={goNext}
          className="min-h-11 px-6 bg-primary text-primary-foreground rounded-xl text-sm font-semibold active:scale-95 transition-transform"
        >
          {isLast ? "Done" : "Next →"}
        </button>
      </div>
    </div>
  );
}
