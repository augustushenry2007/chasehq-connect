import { ArrowRight } from "lucide-react";
import { useFlow } from "@/flow/FlowMachine";

export default function WelcomeScreen() {
  const { send: sendFlow } = useFlow();

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <div
          className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 animate-fade-in"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
        >
          <div className="w-6 h-6 rounded-md bg-primary" />
        </div>

        <h1
          className="text-[28px] leading-[1.15] font-bold text-foreground tracking-tight animate-fade-in"
          style={{ animationDelay: "120ms", animationFillMode: "both" }}
        >
          Following up on payments<br />shouldn't feel this hard.
        </h1>

        <p
          className="mt-4 text-base text-muted-foreground leading-relaxed max-w-sm animate-fade-in"
          style={{ animationDelay: "320ms", animationFillMode: "both" }}
        >
          We'll handle what to say, how to say it, and when to send.
        </p>

        <button
          onClick={() => navigate("/onboarding")}
          className="mt-10 w-full max-w-xs flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] hover:bg-primary/90 animate-fade-in"
          style={{ animationDelay: "520ms", animationFillMode: "both" }}
        >
          Start <ArrowRight className="w-4 h-4" />
        </button>

        <p
          className="mt-6 text-xs text-muted-foreground animate-fade-in"
          style={{ animationDelay: "720ms", animationFillMode: "both" }}
        >
          Takes less than 2 minutes
        </p>
      </div>
    </div>
  );
}
