import { Sparkles } from "lucide-react";
import AuthForm from "@/components/auth/AuthForm";

export default function PostInvoiceAuthScreen() {
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
