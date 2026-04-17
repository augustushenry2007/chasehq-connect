import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Mail, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Path to redirect back to after Google OAuth completes */
  redirectPath: string;
}

export default function GmailConnectSheet({ open, onOpenChange, redirectPath }: Props) {
  const { connectGmail, signedInWithGoogle, googleEmail } = useGmailConnection();
  const [busy, setBusy] = useState(false);

  async function handleConnect() {
    setBusy(true);
    const res = await connectGmail(redirectPath);
    if (res.error) {
      toast.error(res.error);
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border">
        <SheetHeader className="text-left">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <SheetTitle className="text-lg">One last step before sending</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            {signedInWithGoogle && googleEmail
              ? `Allow ChaseHQ to send this follow-up from ${googleEmail}.`
              : "Connect your email so we can send this follow-up on your behalf."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-muted/60 border border-border">
          <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            We only use this to send messages you approve. We never read your inbox.
          </p>
        </div>

        <button
          onClick={handleConnect}
          disabled={busy}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        <button
          onClick={() => onOpenChange(false)}
          className="mt-2 w-full text-xs text-muted-foreground py-2"
        >
          Not now
        </button>
      </SheetContent>
    </Sheet>
  );
}
