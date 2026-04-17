import { useNavigate } from "react-router-dom";
import QuickstartLayout from "./QuickstartLayout";
import { Clock } from "lucide-react";

export default function AskScreen() {
  const navigate = useNavigate();

  function handleYes() {
    navigate("/quickstart/invoice");
  }

  function handleDemo() {
    // Prefill demo invoice via query string
    navigate("/quickstart/invoice?demo=1");
  }

  return (
    <QuickstartLayout step={2} showBack onBack={() => navigate("/quickstart/welcome")}>
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Clock className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          Got a payment you're waiting on?
        </h1>
        <p className="text-base text-muted-foreground mt-3 leading-relaxed">
          Tell us about it and we'll draft the follow-up for you. No client info leaves your account.
        </p>
      </div>
      <div className="space-y-2.5 mt-6">
        <button
          onClick={handleYes}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-base font-semibold"
        >
          Yes — let's draft it
        </button>
        <button
          onClick={handleDemo}
          className="w-full text-sm text-muted-foreground py-2.5 hover:text-foreground transition-colors"
        >
          Not right now — show me an example
        </button>
      </div>
    </QuickstartLayout>
  );
}
