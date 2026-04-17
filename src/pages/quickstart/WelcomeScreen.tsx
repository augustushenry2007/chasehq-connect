import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import QuickstartLayout from "./QuickstartLayout";
import { Sparkles } from "lucide-react";

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { fullName, user } = useApp();
  const firstName = fullName?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <QuickstartLayout step={1}>
      <div className="flex-1 flex flex-col justify-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground leading-tight">
          Hi {firstName}.
        </h1>
        <h2 className="text-3xl font-bold text-foreground leading-tight mt-1">
          Following up shouldn't feel this hard.
        </h2>
        <p className="text-base text-muted-foreground mt-4 leading-relaxed">
          In the next minute, you'll see a real follow-up message — written for your situation, ready to send.
        </p>
      </div>
      <button
        onClick={() => navigate("/quickstart/ask")}
        className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-base font-semibold mt-6"
      >
        Show me
      </button>
    </QuickstartLayout>
  );
}
