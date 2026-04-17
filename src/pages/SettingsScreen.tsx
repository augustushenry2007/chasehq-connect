import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, type ScheduleRow } from "@/context/AppContext";
import {
  ChevronDown, ChevronUp, RefreshCw, LogOut, Plus, Trash2, Mail, Loader2,
  User as UserIcon, Bell, Shield, Download, FileText, ScrollText, AlertTriangle, Server,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useSendingMailbox } from "@/hooks/useSendingMailbox";
import { useInvoices } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SmtpPreset = {
  id: string;
  label: string;
  host: string;
  port: number;
  helpUrl?: string;
  helpText?: string;
};

const SMTP_PRESETS: SmtpPreset[] = [
  { id: "outlook", label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, helpUrl: "https://support.microsoft.com/en-us/account-billing/manage-app-passwords-for-two-step-verification-d6dc8c6d-4bf7-4851-ad95-6d07799387e9", helpText: "Use an app password if you have 2FA enabled." },
  { id: "yahoo", label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: 587, helpUrl: "https://help.yahoo.com/kb/SLN15241.html", helpText: "Yahoo requires an app password — generate one in your account settings." },
  { id: "icloud", label: "iCloud Mail", host: "smtp.mail.me.com", port: 587, helpUrl: "https://support.apple.com/en-us/102654", helpText: "iCloud requires an app-specific password." },
  { id: "custom", label: "Custom SMTP", host: "", port: 587 },
];

type SectionKey = "notifications" | "schedule" | null;

function CollapsibleSection({ title, subtitle, isOpen, onToggle, children }: {
  title: string; subtitle: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-colors ${isOpen ? "border-primary" : "border-border"}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
      {children}
    </p>
  );
}

function NotificationsSection({ notifications, updateNotifications }: {
  notifications: { emailNotifications: boolean; autoChase: boolean; defaultTone: string };
  updateNotifications: (n: any) => void;
}) {
  const tones = ["Polite", "Friendly", "Firm", "Urgent"];
  return (
    <div className="flex flex-col gap-4">
      {[
        { label: "Email notifications", sub: "Receive updates about invoice activity", key: "emailNotifications" as const },
        { label: "Auto-chase", sub: "Automatically send follow-ups on schedule", key: "autoChase" as const },
      ].map((item) => (
        <div key={item.key} className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </div>
          <Switch
            checked={notifications[item.key]}
            onCheckedChange={(checked) => updateNotifications({ ...notifications, [item.key]: checked })}
          />
        </div>
      ))}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Default tone</p>
        <div className="flex flex-wrap gap-2">
          {tones.map((t) => (
            <button
              key={t}
              onClick={() => updateNotifications({ ...notifications, defaultTone: t })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                notifications.defaultTone === t
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleSection({ schedule, updateSchedule }: { schedule: ScheduleRow[]; updateSchedule: (s: ScheduleRow[]) => void }) {
  function updateRow(idx: number, patch: Partial<ScheduleRow>) {
    updateSchedule(schedule.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeRow(idx: number) { updateSchedule(schedule.filter((_, i) => i !== idx)); }
  function addRow() {
    const lastDay = schedule.length > 0 ? Math.max(...schedule.map((r) => r.day)) : 0;
    updateSchedule([...schedule, { id: Date.now(), day: lastDay + 7, action: "New reminder", status: "reminder-2" }]);
  }
  return (
    <div className="flex flex-col gap-2">
      {schedule.map((row, i) => (
        <div key={row.id} className="flex items-center gap-2 p-2.5 bg-muted rounded-xl">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">Day</span>
            <input
              type="number" min={0} value={row.day}
              onChange={(e) => updateRow(i, { day: parseInt(e.target.value) || 0 })}
              className="w-14 px-2 py-1 text-xs font-bold text-primary bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <input
            type="text" value={row.action}
            onChange={(e) => updateRow(i, { action: e.target.value })}
            className="flex-1 px-2.5 py-1.5 text-sm text-foreground bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={() => removeRow(i)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" aria-label="Remove step">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addRow}
        className="mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add follow-up step
      </button>
    </div>
  );
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { user, fullName, notifications, schedule, updateNotifications, updateSchedule, signOut, restartOnboarding } = useApp();
  const { invoices } = useInvoices();
  const [openSection, setOpenSection] = useState<SectionKey>(null);
  const { gmail, loading: gmailLoading, connectGmail, disconnectGmail, signedInWithGoogle, googleEmail } = useGmailConnection();
  const mailbox = useSendingMailbox();
  const [gmailBusy, setGmailBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [smtpOpen, setSmtpOpen] = useState(false);

  function toggleSection(key: SectionKey) { setOpenSection((prev) => (prev === key ? null : key)); }

  async function handleSignOut() { await signOut(); navigate("/auth", { replace: true }); }
  async function handleRestartOnboarding() { await restartOnboarding(); await signOut(); navigate("/auth", { replace: true }); }

  async function handleGrantGmail() {
    setGmailBusy(true);
    const result = await connectGmail();
    if (result.error) { toast.error(result.error); setGmailBusy(false); }
  }

  async function handleDisconnectGmail() {
    setGmailBusy(true);
    await disconnectGmail();
    toast.success("Gmail send permission revoked");
    setGmailBusy(false);
  }

  function handleExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { email: user?.email, authMethod: signedInWithGoogle ? "Google" : "Email" },
      invoices,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chasehq-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      // Delete user-owned rows (RLS scopes them to current user automatically)
      await supabase.from("followups").delete().eq("user_id", user.id);
      await supabase.from("invoices").delete().eq("user_id", user.id);
      await supabase.from("gmail_connections").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("user_id", user.id);
      toast.success("Your data has been deleted");
      await signOut();
      navigate("/auth", { replace: true });
    } catch (e) {
      toast.error("Failed to delete data");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const authMethod = signedInWithGoogle ? "Google" : "Email";

  // Gmail connection states
  const gmailLabel = gmail.connected
    ? `Sending as ${gmail.email}`
    : signedInWithGoogle
      ? `Allow ChaseHQ to send follow-ups from ${googleEmail}`
      : "Connect Gmail to send follow-ups from your inbox";
  const gmailButtonLabel = gmail.connected
    ? "Revoke"
    : signedInWithGoogle
      ? "Grant permission"
      : "Connect";

  return (
    <div className="flex-1 overflow-auto pb-24">
      <div className="px-5 pt-5">
        <h1 className="text-xl font-bold text-foreground mb-4">Settings</h1>

        {/* ACCOUNT */}
        <SectionLabel>Account</SectionLabel>
        <div className="bg-card border border-border rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.email || "—"}</p>
              <p className="text-xs text-muted-foreground">Signed in with {authMethod}</p>
            </div>
          </div>
        </div>

        {/* CONNECTED SERVICES */}
        <SectionLabel>Connected services</SectionLabel>
        <div className="bg-card border border-border rounded-2xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Gmail</p>
                {gmail.connected && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    Active
                  </span>
                )}
              </div>
              {gmailLoading ? (
                <p className="text-xs text-muted-foreground mt-0.5">Checking permission…</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">{gmailLabel}</p>
              )}
              {!gmail.connected && (
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                  We only request the <code className="bg-muted px-1 py-0.5 rounded">gmail.send</code> scope.
                  We never read your inbox.
                </p>
              )}
            </div>
            {gmailLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1" />
            ) : (
              <button
                onClick={gmail.connected ? handleDisconnectGmail : handleGrantGmail}
                disabled={gmailBusy}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 shrink-0 ${
                  gmail.connected
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {gmailBusy ? "…" : gmailButtonLabel}
              </button>
            )}
          </div>
        </div>

        {/* PREFERENCES */}
        <SectionLabel>Preferences</SectionLabel>
        <div className="flex flex-col gap-3 mb-5">
          <CollapsibleSection
            title="Notifications & Chasing"
            subtitle="Email alerts and auto-follow-up settings"
            isOpen={openSection === "notifications"}
            onToggle={() => toggleSection("notifications")}
          >
            <NotificationsSection notifications={notifications} updateNotifications={updateNotifications} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Follow-Up Schedule"
            subtitle="Customize when each follow-up fires"
            isOpen={openSection === "schedule"}
            onToggle={() => toggleSection("schedule")}
          >
            <ScheduleSection schedule={schedule} updateSchedule={updateSchedule} />
          </CollapsibleSection>
        </div>

        {/* DATA CONTROLS */}
        <SectionLabel>Data controls</SectionLabel>
        <div className="bg-card border border-border rounded-2xl divide-y divide-border mb-5">
          <button onClick={handleExport} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
            <Download className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Export my data</p>
              <p className="text-xs text-muted-foreground">Download a JSON copy of your invoices and account info</p>
            </div>
          </button>
          <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Delete my data</p>
              <p className="text-xs text-muted-foreground">Permanently remove your invoices, follow-ups, and Gmail connection</p>
            </div>
          </button>
        </div>

        {/* LEGAL */}
        <SectionLabel>Legal</SectionLabel>
        <div className="bg-card border border-border rounded-2xl divide-y divide-border mb-5">
          <button onClick={() => navigate("/legal/privacy")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <p className="flex-1 text-sm font-medium text-foreground">Privacy Policy</p>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
          </button>
          <button onClick={() => navigate("/legal/terms")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
            <ScrollText className="w-4 h-4 text-muted-foreground" />
            <p className="flex-1 text-sm font-medium text-foreground">Terms of Use</p>
            <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
          </button>
        </div>

        {/* APP CONTROLS */}
        <div className="flex items-center justify-center gap-3 mt-4 mb-4">
          <button onClick={handleRestartOnboarding} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3.5 h-3.5" /> Restart onboarding
          </button>
          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all your data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your invoices, follow-ups, profile, and Gmail
              connection. You will be signed out. This cannot be undone.
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
    </div>
  );
}
