import { useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import AuthForm from "@/components/auth/AuthForm";
import { useApp } from "@/context/AppContext";
import { useFlow } from "@/flow/FlowMachine";

export default function PostInvoiceAuthScreen() {
  const { isAuthenticated, authReady, profileReady, flushedInvoiceId } = useApp();
  const { send } = useFlow();

  // Wait for auth, profile, AND the invoice flush to resolve before navigating.
  // flushedInvoiceId is undefined until the flush useEffect in AppContext completes.
  useEffect(() => {
    if (!isAuthenticated || !profileReady || flushedInvoiceId === undefined) return;
    if (flushedInvoiceId) {
      send("INVOICE_CREATED", { invoiceId: flushedInvoiceId });
    } else {
      send("AUTH_SUCCESS");
    }
  }, [isAuthenticated, profileReady, flushedInvoiceId, send]);

  if (!authReady || isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Setting up your account…</p>
      </div>
    );
  }

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
          Your follow-up is ready.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed mb-6">
          Sign up with Google to save your draft — Gmail send permission is included so ChaseHQ can send follow-ups from your address. We never read your inbox.
        </p>

        <AuthForm
          redirectTo={window.location.origin + "/auth-after-invoice"}
          initialMode="signup"
        />
      </div>
    </div>
  );
}
