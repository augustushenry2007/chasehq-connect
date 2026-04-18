import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import AuthForm from "@/components/auth/AuthForm";
import { useApp } from "@/context/AppContext";
import { useFlow } from "@/flow/FlowMachine";
import { supabase } from "@/integrations/supabase/client";

export default function PostInvoiceAuthScreen() {
  const { isAuthenticated } = useApp();
  const { send } = useFlow();

  // When auth flips to true (Google redirect or email submit), kick off start-trial
  // and advance the flow. AppContext will flush the pending invoice draft.
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try { await supabase.functions.invoke("start-trial"); } catch { /* non-fatal */ }
      send("AUTH_SUCCESS");
    })();
  }, [isAuthenticated, send]);

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8 animate-page-enter">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full mb-4 self-start">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-xs font-semibold text-accent-foreground uppercase tracking-wider">
            Nice work
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          Your first invoice is ready.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed mb-6">
          Create an account to save it and let ChaseHQ chase it for you. Your draft is waiting — nothing is lost.
        </p>

        <AuthForm
          redirectTo={window.location.origin + "/dashboard"}
          initialMode="signup"
          submitLabel={{ signup: "Save my invoice & start trial", signin: "Sign in & save my invoice" }}
        />
      </div>
    </div>
  );
}
