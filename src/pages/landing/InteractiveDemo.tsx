import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Check } from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

const EMAIL_BODY = `Hey Sarah,

Quick nudge on invoice #1042 — let me know if anything's holding it up. Happy to clarify or split it if helpful.

Thanks!`;

type Phase = "idle" | "typing" | "ready" | "sending" | "sent";

export default function InteractiveDemo() {
  const ref = useScrollReveal<HTMLDivElement>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => clearTimers(timersRef.current), []);

  function clearTimers(list: number[]) {
    list.forEach((t) => clearTimeout(t));
    list.length = 0;
  }

  function start() {
    clearTimers(timersRef.current);
    setTyped("");
    setPhase("typing");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyped(EMAIL_BODY);
      setPhase("ready");
      return;
    }
    for (let i = 0; i <= EMAIL_BODY.length; i++) {
      const t = window.setTimeout(() => {
        setTyped(EMAIL_BODY.slice(0, i));
        if (i === EMAIL_BODY.length) setPhase("ready");
      }, i * 22);
      timersRef.current.push(t);
    }
  }

  function send() {
    setPhase("sending");
    const t1 = window.setTimeout(() => setPhase("sent"), 700);
    timersRef.current.push(t1);
  }

  function reset() {
    clearTimers(timersRef.current);
    setPhase("idle");
    setTyped("");
  }

  return (
    <section className="px-6 py-20 sm:py-28 bg-card/40">
      <div ref={ref} className="reveal max-w-3xl mx-auto text-center">
        <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-3">See it in action</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          This is what your follow-ups will sound like.
        </h2>
        <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
          Click below — we'll draft a real follow-up in front of you.
        </p>

        <div className="mt-10 bg-card border border-border rounded-2xl p-6 sm:p-8 text-left shadow-sm">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Follow-up to Acme Co.</p>
              <p className="text-xs text-muted-foreground">Friendly tone · invoice #1042</p>
            </div>
          </div>

          <div className="mt-5 min-h-[180px]">
            {phase === "idle" ? (
              <div className="flex items-center justify-center min-h-[180px]">
                <button
                  onClick={start}
                  className="bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-semibold transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.97] motion-reduce:transform-none"
                >
                  Draft a follow-up
                </button>
              </div>
            ) : (
              <pre
                className={`font-sans text-sm text-foreground leading-relaxed whitespace-pre-wrap transition-opacity duration-500 ${
                  phase === "sending" ? "opacity-50" : "opacity-100"
                } ${phase === "sent" ? "opacity-0" : ""}`}
                aria-live="polite"
              >
                {typed}
                {phase === "typing" && <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary align-middle animate-pulse" />}
              </pre>
            )}

            {phase === "sent" && (
              <div className="flex flex-col items-center justify-center min-h-[180px] -mt-[180px]">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mb-3">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground">Sent in your tone.</p>
                <button
                  onClick={reset}
                  className="mt-4 text-xs font-semibold text-primary underline underline-offset-4"
                >
                  Try it again
                </button>
              </div>
            )}
          </div>

          {phase === "ready" && (
            <div className="mt-5 flex justify-end animate-fade-in">
              <button
                onClick={send}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.97] motion-reduce:transform-none"
              >
                <Send className="w-4 h-4" /> Send
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
