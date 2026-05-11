import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useInvoices } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { FLOW_STORAGE_KEY } from "@/flow/states";
import { toast } from "sonner";
import { Download, AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DataControlsSection() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { invoices } = useInvoices();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    if (!user) return;
    const provider = (user.app_metadata as any)?.provider;
    const providers = (user.app_metadata as any)?.providers as string[] | undefined;
    const signedInWithGoogle = provider === "google" || (providers?.includes("google") ?? false);
    const [followupsRes, profileRes, prefsRes, sendLogRes] = await Promise.all([
      supabase.from("followups").select("invoice_id, subject, tone, is_ai_generated, sent_at").eq("user_id", user.id),
      supabase.from("profiles").select("full_name, onboarding_completed").eq("user_id", user.id).maybeSingle(),
      supabase.from("notification_preferences").select("enabled, email_enabled, quiet_hours_start, quiet_hours_end, timezone").eq("user_id", user.id).maybeSingle(),
      supabase.from("email_send_log").select("recipient, invoice_id, sent_at").eq("user_id", user.id),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      dataController: "ChaseHQ",
      requestedBy: user.email,
      account: {
        email: user.email,
        authMethod: signedInWithGoogle ? "Google" : "Email",
        fullName: profileRes.data?.full_name ?? null,
        accountCreated: (user as any).created_at ?? null,
      },
      invoices,
      followupsSent: followupsRes.data ?? [],
      emailSendLog: sendLogRes.data ?? [],
      notificationPreferences: prefsRes.data ?? null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chasehq-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      localStorage.removeItem(FLOW_STORAGE_KEY);
      navigate("/", { replace: true });
    } catch {
      toast.error("We couldn't finish that just now. Try again in a moment.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <div className="flex flex-col divide-y divide-border -mx-4 -my-4">
        <button onClick={handleExport} className="flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
          <Download className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Export my data</p>
            <p className="text-xs text-muted-foreground">Download a JSON copy of your invoices and account info</p>
          </div>
        </button>
        <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Delete my data</p>
            <p className="text-xs text-muted-foreground">Permanently remove your invoices, follow-ups, and connections</p>
          </div>
        </button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, invoices, and follow-ups.
              You will not be able to sign back in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
