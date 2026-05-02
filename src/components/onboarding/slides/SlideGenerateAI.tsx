import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const FULL_TEXT =
  "Hi Sarah, I hope you're doing well. I'm following up on Invoice #1042 for $1,200, which was due on April 15th. Could you let me know when payment can be arranged? Happy to answer any questions. Thanks!";

export function SlideGenerateAI() {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 2;
      setDisplayed(FULL_TEXT.slice(0, i));
      if (i >= FULL_TEXT.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground mb-1">Generate with AI</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Each draft starts from one of the five templates above — AI tailors it to your invoice details, days overdue, and chosen tone. Edit it, or send it as-is.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">AI Follow-up Draft</p>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-primary/10 text-primary"}`}>
            <Sparkles className="w-3 h-3" />
            {done ? "Ready to edit" : "Writing…"}
          </div>
        </div>
        <div className="px-4 py-3 min-h-[100px]">
          <p className="text-sm text-foreground leading-relaxed">
            {displayed}
            {!done && <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />}
          </p>
        </div>
      </div>

      <div className="bg-muted/30 rounded-xl px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">Always in your control.</span>{" "}
          Nothing sends without your review. You can edit the draft, change the tone, or regenerate.
        </p>
      </div>
    </div>
  );
}
