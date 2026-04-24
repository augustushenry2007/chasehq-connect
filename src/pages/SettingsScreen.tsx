import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { type SchedulePreset } from "@/lib/scheduleDefaults";
import {
  ChevronDown, RefreshCw, LogOut, Mail, Loader2, Sparkles,
  User as UserIcon, Bell, Shield, Download, FileText, ScrollText, AlertTriangle, Server, CreditCard, ChevronRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useSendingMailbox } from "@/hooks/useSendingMailbox";
import { useInvoices } from "@/hooks/useSupabaseData";
import { useEntitlement } from "@/hooks/useEntitlement";
import { supabase } from "@/integrations/supabase/client";
import { FLOW_STORAGE_KEY } from "@/flow/states";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import NotificationBell from "@/components/NotificationBell";
import { startGoogleOAuth } from "@/lib/oauth";
import { GoogleIcon } from "@/components/GoogleIcon";

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

type SectionKey = "notifications" | "schedule" | "data" | null;

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
        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
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

const DEFAULT_TONES = ["Polite", "Friendly", "Firm"] as const;

function NotificationsSection({ notifications, updateNotifications }: {
  notifications: { emailNotifications: boolean; autoChase: boolean; defaultTone: string };
  updateNotifications: (n: any) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {[
        { label: "Email Notifications", sub: "Get an email when a follow-up is due to send", key: "emailNotifications" as const },
        { label: "Push Reminders", sub: "Notify me when it's time to send the next follow-up", key: "autoChase" as const },
      ].map((item) => (
        <div key={item.key} className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
          </div>
          <Switch
            checked={notifications[item.key]}
            onCheckedChange={(checked) => updateNotifications({ ...notifications, [item.key]: checked })}
          />
        </div>
      ))}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">Default tone</p>
        <p className="text-xs text-muted-foreground mb-2.5">Applied when drafting follow-ups</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_TONES.map((tone) => (
            <button
              key={tone}
              onClick={() => updateNotifications({ ...notifications, defaultTone: tone })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                notifications.defaultTone === tone
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleSection() {
  const [preset, setPreset] = useState<SchedulePreset>(() =>
    (localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) ?? "active") as SchedulePreset
  );
  function pickPreset(p: SchedulePreset) {
    setPreset(p);
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, p); } catch {}
  }
  const descriptions: Record<SchedulePreset, string> = {
    active:  "Day 3, 7, 14, 21 · Friendly → Firm → Urgent → Final Notice",
    patient: "Day 3, 10, 21, 42 · Friendly → Friendly → Firm → Firm",
    light:   "Day 3, 14, 28, 42 · Friendly → Friendly → Friendly → Firm",
  };
  return (
    <div className="flex flex-col gap-3">
      {(["active", "patient", "light"] as SchedulePreset[]).map((p) => (
        <button
          key={p}
          onClick={() => pickPreset(p)}
          className={`text-left px-3.5 py-3 rounded-xl border-[1.5px] transition-colors ${preset === p ? "border-primary bg-accent" : "border-border bg-card"}`}
        >
          <p className="text-sm font-semibold text-foreground capitalize">{p}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{descriptions[p]}</p>
        </button>
      ))}
      <p className="text-[11px] text-muted-foreground px-1">Applies to new invoices. Edit per-invoice in the invoice detail.</p>
    </div>
  );
}

function SmtpCard({
  open, setOpen, mailbox, defaultFromEmail, defaultFromName,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  mailbox: ReturnType<typeof useSendingMailbox>;
  defaultFromEmail: string;
  defaultFromName: string;
}) {
  const [presetId, setPresetId] = useState<string>("outlook");
  const preset = SMTP_PRESETS.find((p) => p.id === presetId)!;
  const [fromEmail, setFromEmail] = useState(defaultFromEmail);
  const [fromName, setFromName] = useState(defaultFromName);
  const [host, setHost] = useState(preset.host);
  const [port, setPort] = useState(preset.port);
  const [username, setUsername] = useState(defaultFromEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function applyPreset(id: string) {
    setPresetId(id);
    const p = SMTP_PRESETS.find((x) => x.id === id)!;
    if (p.host) setHost(p.host);
    if (p.port) setPort(p.port);
  }

  async function handleSave() {
    if (!fromEmail || !host || !port || !username || !password) {
      toast.error("Fill in host, port, username, and password to connect.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("smtp-verify", {
      body: {
        from_email: fromEmail, from_name: fromName || null,
        smtp_host: host, smtp_port: port, smtp_username: username, smtp_password: password,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "We couldn't reach your email provider. Double-check the details and try once more.");
      return;
    }
    if ((data as any)?.verified === false) {
      toast.error((data as any)?.error || "Those credentials didn't work. Check the password — many providers need an app-specific one.");
      return;
    }
    toast.success("Connected");
    setPassword("");
    setOpen(false);
    await mailbox.refetch();
  }

  async function handleDisconnect() {
    if (!mailbox.smtp) return;
    setBusy(true);
    await supabase.from("smtp_connections").delete().eq("user_id", mailbox.smtp.user_id);
    if (mailbox.activeSender === "smtp") {
      await mailbox.setActiveSender(mailbox.hasGmail ? "gmail" : "none");
    }
    setBusy(false);
    toast.success("Disconnected");
    await mailbox.refetch();
  }

  const connected = mailbox.hasSmtp;
  const isActive = mailbox.activeSender === "smtp";

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
          <Server className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Other email (SMTP)</p>
            {connected && isActive && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {connected
              ? `Sending as ${mailbox.smtp?.from_email}`
              : "For Outlook, Yahoo, iCloud, or any custom domain."}
          </p>
        </div>
        {connected ? (
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive disabled:opacity-50 shrink-0"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => setOpen(!open)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground shrink-0"
          >
            {open ? "Close" : "Connect"}
          </button>
        )}
      </div>

      {open && !connected && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Provider</label>
            <select
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SMTP_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {preset.helpText && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {preset.helpText}{" "}
                {preset.helpUrl && (
                  <a href={preset.helpUrl} target="_blank" rel="noreferrer" className="underline text-primary">Learn more</a>
                )}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SmtpField label="From name" value={fromName} onChange={setFromName} placeholder="Your name" />
            <SmtpField label="From email" value={fromEmail} onChange={setFromEmail} placeholder="you@domain.com" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SmtpField label="SMTP host" value={host} onChange={setHost} placeholder="smtp.example.com" />
            <SmtpField label="Port" value={String(port)} onChange={(v) => setPort(parseInt(v) || 587)} placeholder="587" />
          </div>
          <SmtpField label="Username" value={username} onChange={setUsername} placeholder="usually your email" />
          <SmtpField label="Password" value={password} onChange={setPassword} placeholder="App password" type="password" />
          <button
            onClick={handleSave}
            disabled={busy}
            className="mt-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & save"}
          </button>
          <p className="text-[11px] text-muted-foreground">
            We'll send a test message to your own address to confirm the connection works.
          </p>
        </div>
      )}
    </div>
  );
}

function SmtpField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { user, isAuthenticated, fullName, notifications, updateNotifications, updateDisplayName, signOut, restartOnboarding } = useApp();
  const [editName, setEditName] = useState(fullName || "");
  const [nameSaved, setNameSaved] = useState(false);
  const nameSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setEditName(fullName || ""); }, [fullName]);

  async function handleSaveName() {
    const trimmed = editName.trim();
    if (trimmed === (fullName || "")) return;
    await updateDisplayName(trimmed || null);
    if (nameSavedTimerRef.current) clearTimeout(nameSavedTimerRef.current);
    setNameSaved(true);
    nameSavedTimerRef.current = setTimeout(() => setNameSaved(false), 1500);
  }
  const { invoices } = useInvoices();
  const ent = useEntitlement();
  const [openSection, setOpenSection] = useState<SectionKey>(null);
  const { signedInWithGoogle } = useGmailConnection();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="flex-1 overflow-auto pb-24 animate-page-enter">
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              You've done the hard part.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Let ChaseHQ handle the follow-ups — so you never have to think about chasing payments again.
            </p>
            <button
              onClick={() => startGoogleOAuth(window.location.origin + "/auth-after-invoice")}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] hover:bg-primary/90 mb-3"
            >
              <GoogleIcon className="w-4 h-4" />
              Continue where you left off
            </button>
            <p className="text-xs text-muted-foreground">Free for 14 days. No card required.</p>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              By continuing, you grant ChaseHQ permission to send emails from your Gmail address on your behalf. We never read your inbox.
            </p>
          </div>

          <div className="pointer-events-none select-none opacity-30 blur-[1.5px]">
            <SectionLabel>Account</SectionLabel>
            <div className="bg-card border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Your name</p>
                  <p className="text-xs text-muted-foreground">your@email.com</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Signed in with Google</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 mb-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Billing</p>
                <p className="text-xs text-muted-foreground mt-0.5">Free trial · 14 days left</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>

            <SectionLabel>Preferences</SectionLabel>
            <div className="flex flex-col gap-3 mb-5">
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">Email alerts and reminders</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-semibold text-foreground">Default follow-up schedule</p>
                <p className="text-xs text-muted-foreground mt-0.5">Applies to new invoices</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function toggleSection(key: SectionKey) { setOpenSection((prev) => (prev === key ? null : key)); }

  async function handleSignOut() { await signOut(); navigate("/onboarding", { replace: true }); }
  async function handleRestartOnboarding() { await restartOnboarding(); await signOut(); navigate("/onboarding", { replace: true }); }

  async function handleExport() {
    if (!user) return;
    const [followupsRes, profileRes, prefsRes, sendLogRes, gmailRes] = await Promise.all([
      supabase.from("followups").select("invoice_id, subject, tone, is_ai_generated, sent_at").eq("user_id", user.id),
      supabase.from("profiles").select("full_name, onboarding_completed, sender_type").eq("user_id", user.id).maybeSingle(),
      supabase.from("notification_preferences").select("enabled, email_enabled, quiet_hours_start, quiet_hours_end, timezone").eq("user_id", user.id).maybeSingle(),
      supabase.from("email_send_log").select("recipient, invoice_id, sent_at").eq("user_id", user.id),
      supabase.from("gmail_connections").select("email, token_expires_at").eq("user_id", user.id).maybeSingle(),
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
      connectedAccounts: {
        gmail: gmailRes.data ? { email: gmailRes.data.email, tokenExpiresAt: gmailRes.data.token_expires_at } : null,
      },
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
    } catch (e) {
      toast.error("We couldn't finish that just now. Try again in a moment.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const authMethod = "Google";



  return (
    <div className="flex-1 overflow-auto pb-24 animate-page-enter">
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <NotificationBell />
        </div>

        {/* ACCOUNT */}
        <SectionLabel>Account</SectionLabel>
        <div className="bg-card border border-border rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 -mb-0.5">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder="Add your name"
                  className="text-sm font-semibold text-foreground bg-transparent focus:outline-none w-full truncate placeholder:text-muted-foreground/50 border-b border-transparent focus:border-primary/40 transition-colors pb-0.5"
                />
                {nameSaved && <span className="text-[11px] text-green-600 shrink-0 font-medium">✓ Saved</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-1">{user?.email || "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Signed in with {authMethod}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate("/settings/billing")}
          className="w-full bg-card border border-border rounded-2xl p-4 mb-5 flex items-center gap-3 hover:border-primary/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-foreground">Billing</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ent.loading ? "Loading…"
                : ent.isTrialing ? `Free trial • ${ent.daysLeftInTrial ?? 0} day${ent.daysLeftInTrial === 1 ? "" : "s"} left`
                : ent.isActive ? `Active • renews ${ent.nextBillingDate?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? ""}`
                : ent.isPastDue ? "Payment past due"
                : ent.status === "canceled" ? "Canceled"
                : ent.status === "expired" ? "Expired — start free trial"
                : "Start your 14-day free trial"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* PREFERENCES */}
        <SectionLabel>Preferences</SectionLabel>
        <div className="flex flex-col gap-3 mb-5">
          <CollapsibleSection
            title="Notifications"
            subtitle="Email alerts and reminders"
            isOpen={openSection === "notifications"}
            onToggle={() => toggleSection("notifications")}
          >
            <NotificationsSection notifications={notifications} updateNotifications={updateNotifications} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Default follow-up schedule"
            subtitle="Applies to new invoices. Edit per-invoice on its detail page."
            isOpen={openSection === "schedule"}
            onToggle={() => toggleSection("schedule")}
          >
            <ScheduleSection />
          </CollapsibleSection>
        </div>

        {/* DATA CONTROLS — collapsible */}
        <SectionLabel>Data controls</SectionLabel>
        <div className="mb-5">
          <CollapsibleSection
            title="Your data"
            subtitle="Export or delete your account data"
            isOpen={openSection === "data"}
            onToggle={() => toggleSection("data")}
          >
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
          </CollapsibleSection>
        </div>

        {/* LEGAL */}
        <SectionLabel>Legal</SectionLabel>
        <div className="bg-card border border-border rounded-2xl divide-y divide-border mb-5">
          <button onClick={() => navigate("/legal/privacy")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <p className="flex-1 text-sm font-semibold text-foreground">Privacy Policy</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/legal/terms")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
            <ScrollText className="w-4 h-4 text-muted-foreground" />
            <p className="flex-1 text-sm font-semibold text-foreground">Terms of Use</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, invoices, follow-ups, and Gmail
              connection. You will not be able to sign back in. This cannot be undone.
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
