import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QuickstartLayout from "./QuickstartLayout";
import { useApp } from "@/context/AppContext";
import { CheckCircle2 } from "lucide-react";

export default function SentScreen() {
  const navigate = useNavigate();
  const { completeOnboarding } = useApp();

  useEffect(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  return (
    <QuickstartLayout step={5}>
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground leading-tight">
          Nice. That's done.
        </h1>
        <p className="text-base text-muted-foreground mt-3 leading-relaxed">
          Most freelancers delay this by 2–3 days. You just did it in one.
        </p>
        <div className="mt-6 p-4 rounded-2xl bg-muted/60 border border-border">
          <p className="text-sm text-foreground font-medium">What happens next</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            If your client doesn't reply in 3 days, we'll draft the next follow-up automatically — slightly firmer. You'll review it before it sends.
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate("/dashboard")}
        className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-base font-semibold mt-6"
      >
        Go to dashboard
      </button>
    </QuickstartLayout>
  );
}
