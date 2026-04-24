import { ArrowRight } from "lucide-react";
import { useFlow } from "@/flow/FlowMachine";
import { startGoogleOAuth } from "@/lib/oauth";
import appLogo from "@/assets/app-logo.png";

export default function WelcomeScreen() {
  const { send: sendFlow } = useFlow();

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <img
          src={appLogo}
          alt="ChaseHQ logo"
          className="w-20 h-20 rounded-2xl mb-8 animate-fade-in shadow-sm"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
        />

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
          It does for most freelancers. You're not alone — and you're not wrong to dread it.
        </p>

        <button
          onClick={() => sendFlow("START")}
          className="mt-10 w-full max-w-xs flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] hover:bg-primary/90 animate-fade-in"
          style={{ animationDelay: "520ms", animationFillMode: "both" }}
        >
          Stop chasing. Start getting paid. <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => startGoogleOAuth(window.location.origin)}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
          style={{ animationDelay: "620ms", animationFillMode: "both" }}
        >
          Already have an account? <span className="underline underline-offset-2">Sign in</span>
        </button>

      </div>
    </div>
  );
}
