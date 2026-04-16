import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ChevronLeft, ChevronRight, ArrowRight, Check, Mail, Clock, Zap } from "lucide-react";

const Q0 = {
  label: "Just checking in",
  question: "When it comes to money conversations, I feel…",
  sub: "Select all that apply, or add your own.",
  placeholder: "e.g. stressed, resentful, powerless…",
  options: [
    { id: "anxious", label: "Anxious", detail: "I overthink every interaction and second-guess myself" },
    { id: "guilty", label: "Guilty", detail: "Like I shouldn't be asking for what I'm already owed" },
    { id: "frustrated", label: "Frustrated", detail: "It's exhausting and draining to deal with every time" },
  ],
};

const Q1 = {
  label: "A little more",
  question: "When I think about sending a follow-up…",
  sub: "Tick everything that rings true, or describe it yourself.",
  placeholder: "e.g. I freeze up, I feel embarrassed…",
  options: [
    { id: "hesitant", label: "I hesitate", detail: "I draft it five times and then don't send any of them" },
    { id: "relationship", label: "I worry", detail: "What if it damages the relationship or makes me look desperate?" },
    { id: "procrastinate", label: "I put it off", detail: "Until it's awkward to bring up and I've lost the moment" },
  ],
};

const Q2 = {
  label: "Last one",
  question: "What would actually make this easier?",
  sub: "Choose as many as feel right, or say it your way.",
  placeholder: "e.g. templates, a nudge, less guilt…",
  options: [
    { id: "words", label: "The right words", detail: "Already written — so I never stare at a blank screen again" },
    { id: "timing", label: "The right moment", detail: "Knowing exactly when to reach out without overthinking it" },
    { id: "automation", label: "Full automation", detail: "Set it and forget it — no manual effort from me at all" },
  ],
};

const INTEGRATIONS = [
  { name: "FreshBooks", color: "#1AB5D1", initial: "FB", desc: "Import invoices and sync payment status" },
  { name: "Xero", color: "#13B5EA", initial: "X", desc: "Pull unpaid invoices and trigger chase sequences" },
  { name: "QuickBooks", color: "#2BA01B", initial: "QB", desc: "Automatically chase overdue QBO invoices" },
  { name: "Bonsai", color: "#6C47FF", initial: "B", desc: "Sync freelance contracts and invoices" },
];

const TOTAL_STEPS = 6;

function MultiSelectStep({ config, selected, onToggle, customText, setCustomText }: {
  config: typeof Q0; selected: Set<string>; onToggle: (id: string) => void; customText: string; setCustomText: (s: string) => void;
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-primary uppercase tracking-wider">{config.label}</span>
      <h2 className="text-xl font-bold text-foreground mt-2 mb-1">{config.question}</h2>
      <p className="text-sm text-muted-foreground mb-5">{config.sub}</p>
      <div className="flex flex-col gap-2.5">
        {config.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onToggle(opt.id)}
            className={`text-left p-4 rounded-xl border-[1.5px] transition-colors ${selected.has(opt.id) ? "border-primary bg-accent" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center shrink-0 ${selected.has(opt.id) ? "bg-primary border-primary" : "border-border"}`}>
                {selected.has(opt.id) && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.detail}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <input
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        placeholder={config.placeholder}
        className="w-full mt-4 px-4 py-3 rounded-xl border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { completeOnboarding } = useApp();

  const [step, setStep] = useState(0);
  const [selected0, setSelected0] = useState<Set<string>>(new Set());
  const [selected1, setSelected1] = useState<Set<string>>(new Set());
  const [selected2, setSelected2] = useState<Set<string>>(new Set());
  const [custom0, setCustom0] = useState("");
  const [custom1, setCustom1] = useState("");
  const [custom2, setCustom2] = useState("");
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());

  const progress = (step / TOTAL_STEPS) * 100;

  function canAdvance() {
    if (step === 0) return selected0.size > 0 || custom0.trim().length > 0;
    if (step === 1) return selected1.size > 0 || custom1.trim().length > 0;
    if (step === 2) return selected2.size > 0 || custom2.trim().length > 0;
    return step < TOTAL_STEPS;
  }

  function next() { setStep((s) => s + 1); }
  function back() { if (step > 0) setStep((s) => s - 1); }

  function finish() {
    completeOnboarding();
    navigate("/dashboard", { replace: true });
  }

  function toggleIntegration(name: string) {
    setConnectedIntegrations((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  }

  function makeToggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    return (id: string) => {
      setter((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
      });
    };
  }

  function buildFeelingLabel() {
    const labels = Array.from(selected0).map((id) => Q0.options.find((o) => o.id === id)?.label.toLowerCase() ?? id);
    if (custom0.trim()) labels.push(custom0.trim().toLowerCase());
    if (labels.length === 0) return "";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
  }

  const feelingLabel = buildFeelingLabel();

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header with progress */}
      <div className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,16px)] pb-3">
        <button
          onClick={back}
          className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center ${step > 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={() => canAdvance() && next()}
          className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center ${canAdvance() ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-5 pb-8">
        <div className="bg-card border border-border rounded-2xl p-5 mt-2">
          {step === 0 && <MultiSelectStep config={Q0} selected={selected0} onToggle={makeToggle(setSelected0)} customText={custom0} setCustomText={setCustom0} />}
          {step === 1 && <MultiSelectStep config={Q1} selected={selected1} onToggle={makeToggle(setSelected1)} customText={custom1} setCustomText={setCustom1} />}
          {step === 2 && <MultiSelectStep config={Q2} selected={selected2} onToggle={makeToggle(setSelected2)} customText={custom2} setCustomText={setCustom2} />}

          {step === 3 && (
            <div>
              {feelingLabel && (
                <div className="inline-block bg-accent px-3 py-1.5 rounded-full mb-4">
                  <span className="text-xs font-medium text-accent-foreground">You said you feel {feelingLabel}</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-5">
                {selected0.size + (custom0.trim() ? 1 : 0) > 1
                  ? "You're not carrying just one thing. That combination makes sense — and it's more common than you'd think."
                  : selected0.has("anxious") ? "That anxiety isn't a flaw. It means you care about how you come across."
                  : selected0.has("guilty") ? "That guilt is real. But you did the work — you've already earned this."
                  : selected0.has("frustrated") ? "That frustration makes sense. You shouldn't have to fight this hard to get paid."
                  : "That makes sense. You're not alone in this struggle."}
              </p>
              <div className="bg-dark text-primary-foreground rounded-xl p-5 mb-4">
                <p className="text-base font-bold mb-1">The real problem isn't you.</p>
                <p className="text-sm opacity-80">It's deciding what to say, when to say it, and how.</p>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                And that's where you stop. You don't make those decisions anymore — we do.
              </p>
              <button onClick={next} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm">
                Show me how <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">How it removes the mental load</span>
              <h2 className="text-xl font-bold text-foreground mt-2 mb-5">Three things you'll never have to do again</h2>
              <div className="flex flex-col gap-4 mb-6">
                {[
                  { icon: Mail, title: "Write the message", desc: "We draft every follow-up in your voice, matching your tone and style" },
                  { icon: Clock, title: "Decide when to send", desc: "Our timeline triggers the right message at the right moment" },
                  { icon: Zap, title: "Hit send", desc: "It goes out automatically — unless you want to review first" },
                ].map((f) => (
                  <div key={f.title} className="flex gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                      <f.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={next} className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm">
                Connect my tools
              </button>
            </div>
          )}

          {step === 5 && (
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Almost there</span>
              <h2 className="text-xl font-bold text-foreground mt-2 mb-1">Connect your invoicing tool</h2>
              <p className="text-sm text-muted-foreground mb-5">We'll import your unpaid invoices and start chasing for you.</p>
              <div className="flex flex-col gap-2.5 mb-6">
                {INTEGRATIONS.map((integ) => {
                  const isConnected = connectedIntegrations.has(integ.name);
                  return (
                    <button
                      key={integ.name}
                      onClick={() => toggleIntegration(integ.name)}
                      className={`flex items-center gap-3 p-4 rounded-xl border-[1.5px] transition-colors text-left ${isConnected ? "border-primary bg-accent" : "border-border bg-card"}`}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0" style={{ backgroundColor: integ.color }}>
                        {integ.initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{integ.name}</p>
                        <p className="text-xs text-muted-foreground">{integ.desc}</p>
                      </div>
                      {isConnected && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <button onClick={next} className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm">
                {connectedIntegrations.size > 0 ? "Continue" : "Skip for now"}
              </button>
            </div>
          )}

          {step === 6 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">You're all set</h2>
              <p className="text-sm text-muted-foreground mb-6">
                ChaseHQ will handle the follow-ups so you can focus on the work.
              </p>
              <button onClick={finish} className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm">
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
