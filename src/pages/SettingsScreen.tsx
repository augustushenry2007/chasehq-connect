import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { type SchedulePreset, type ScheduleStep, PRESET_STEPS, getDefaultStepsForInvoice } from "@/lib/scheduleDefaults";
import {
  ChevronDown, LogOut, Mail, Loader2, Sparkles,
  User as UserIcon, Bell, Shield, Download, FileText, ScrollText, AlertTriangle, Server, CreditCard, ChevronRight,
} from "lucide-react";
import { requestLocalNotificationPermission, cancelAllPending } from "@/lib/localNotifications";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const ONBOARDING_STORAGE_KEY = "onboarding_v5";

function deriveOnboardingDefaults(): { tone: "Friendly" | "Firm"; preset: "patient" | "light" | "active" } {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return { tone: "Friendly", preset: "patient" };
    const data = JSON.parse(raw);
    const toneMap: Record<string, "Friendly" | "Firm"> = { friendly: "Friendly", firm: "Firm" };
    const presetMap: Record<string, "patient" | "light" | "active"> = { wait: "patient", nudge: "light", persist: "active" };
    return {
      tone: toneMap[data?.tone_preference] ?? "Friendly",
      preset: presetMap[data?.chase_instinct] ?? "patient",
    };
  } catch { return { tone: "Friendly", preset: "patient" }; }
}
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
import { GoogleAuthSheet } from "@/components/auth/GoogleAuthSheet";
import { useFlow } from "@/flow/FlowMachine";

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

const DEFAULT_TONES = ["Friendly", "Firm"] as const;

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

const SCHEDULE_TONE_OPTIONS: ScheduleStep["tone"][] = ["Friendly", "Firm", "Urgent", "Final Notice"];

function ScheduleSection() {
  const [preset, setPreset] = useState<SchedulePreset>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) as SchedulePreset | null;
    return stored ?? deriveOnboardingDefaults().preset;
  });

  // savedCustom: steps committed to localStorage (null = no custom override, use preset)
  const [savedCustom, setSavedCustom] = useState<ScheduleStep[] | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch { return null; }
  });

  // draftSteps: what the user is currently editing (may differ from savedCustom until Save)
  const [draftSteps, setDraftSteps] = useState<ScheduleStep[]>(() => getDefaultStepsForInvoice());

  const [confirmPreset, setConfirmPreset] = useState<SchedulePreset | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const hasCustom = savedCustom !== null;
  const baseSteps = savedCustom ?? PRESET_STEPS[preset];
  const isDirty = JSON.stringify(draftSteps) !== JSON.stringify(baseSteps);

  function applyPreset(p: SchedulePreset) {
    setPreset(p);
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, p); } catch {}
    try { localStorage.removeItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS); } catch {}
    setSavedCustom(null);
    setDraftSteps(PRESET_STEPS[p].map((s) => ({ ...s })));
    setConfirmPreset(null);
  }

  function pickPreset(p: SchedulePreset) {
    if (hasCustom && p !== preset) { setConfirmPreset(p); } else { applyPreset(p); }
  }

  function updateOffset(idx: number, val: number) {
    setDraftSteps((prev) => prev.map((s, i) => i === idx ? { ...s, offset_days: Math.max(1, val) } : s));
  }

  function updateTone(idx: number, tone: ScheduleStep["tone"]) {
    const type: ScheduleStep["type"] = (tone === "Final Notice" || tone === "Urgent") ? "escalation" : "followup";
    setDraftSteps((prev) => prev.map((s, i) => i === idx ? { ...s, tone, type } : s));
  }

  function removeStep(idx: number) {
    if (draftSteps.length <= 1) return;
    setDraftSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function addStep() {
    const lastOffset = draftSteps[draftSteps.length - 1]?.offset_days ?? 7;
    setDraftSteps((prev) => [...prev, { offset_days: lastOffset + 7, tone: "Firm", type: "followup", status: "pending" }]);
  }

  function resetToPreset() {
    try { localStorage.removeItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS); } catch {}
    setSavedCustom(null);
    setDraftSteps(PRESET_STEPS[preset].map((s) => ({ ...s })));
  }

  function handleSave() {
    const steps = [...draftSteps];
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS, JSON.stringify(steps)); } catch {}
    setSavedCustom(steps);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  function handleDiscard() {
    setDraftSteps(baseSteps.map((s) => ({ ...s })));
  }

  const descriptions: Record<SchedulePreset, { tagline: string; cadence: string; tones: string }> = {
    active:  { tagline: "Pay attention",       cadence: "Day 3 · 7 · 14 · 21",   tones: "Friendly → Firm → Urgent → Final Notice" },
    patient: { tagline: "Steady professional", cadence: "Day 5 · 13 · 20 · 23",  tones: "Friendly → Friendly → Firm → Final Notice" },
    light:   { tagline: "Relationship-first",  cadence: "Day 7 · 14 · 21 · 28",  tones: "Friendly → Friendly → Firm → Firm" },
  };

  return (
    <div className="flex flex-col gap-3">
      {(["active", "patient", "light"] as SchedulePreset[]).map((p) => {
        const isActive = preset === p;
        const showCustom = isActive && hasCustom;
        const cadence = showCustom ? savedCustom!.map((s) => `Day ${s.offset_days}`).join(" · ") : descriptions[p].cadence;
        const tones = showCustom ? savedCustom!.map((s) => s.tone).join(" → ") : descriptions[p].tones;
        return (
          <button
            key={p}
            onClick={() => pickPreset(p)}
            className={`text-left px-3.5 py-3 rounded-xl border-[1.5px] transition-colors ${isActive ? "border-primary bg-accent" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-foreground capitalize">{p} <span className="font-normal text-muted-foreground">· {descriptions[p].tagline}</span></p>
              {showCustom && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">Custom</span>
              )}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{cadence}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{tones}</p>
          </button>
        );
      })}

      {/* Customize default schedule */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setCustomOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
        >
          <span className="text-xs font-semibold text-foreground">Customize your default</span>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${customOpen ? "rotate-180" : ""}`} />
        </button>
        {customOpen && (
          <div className="border-t border-border px-3.5 pb-3.5 pt-2.5">
            <div className="flex flex-col gap-1">
              {draftSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-1.5 flex-wrap py-1">
                  <select
                    value={step.tone}
                    onChange={(e) => updateTone(idx, e.target.value as ScheduleStep["tone"])}
                    className="text-xs bg-muted border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    {SCHEDULE_TONE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <span className="text-xs text-muted-foreground">+</span>
                  <input
                    type="number"
                    min={1}
                    value={step.offset_days}
                    onChange={(e) => updateOffset(idx, parseInt(e.target.value) || 1)}
                    className="w-14 px-2 py-1 text-xs font-bold text-primary bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground flex-1">days after due</span>
                  {draftSteps.length > 1 && (
                    <button
                      onClick={() => removeStep(idx)}
                      className="text-muted-foreground hover:text-destructive text-xs px-1.5 py-0.5 rounded transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={addStep}
                className="text-xs text-primary font-semibold hover:opacity-80 transition-opacity"
              >
                + Add step
              </button>
              <span className="text-muted-foreground text-xs">·</span>
              <button
                onClick={resetToPreset}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset to {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-default"}`}
              >
                Save
              </button>
              {isDirty && (
                <button
                  onClick={handleDiscard}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Discard
                </button>
              )}
              {savedMsg && !isDirty && (
                <span className="text-xs text-green-600 dark:text-green-400">Saved. New invoices will use this schedule.</span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground px-1">Applies to new invoices only. To change a specific invoice, edit it from its detail page.</p>

      {/* Confirm preset switch when custom steps exist */}
      {confirmPreset && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setConfirmPreset(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-foreground mb-1">Replace your custom schedule?</p>
            <p className="text-xs text-muted-foreground mb-4">Switching to {confirmPreset.charAt(0).toUpperCase() + confirmPreset.slice(1)} will clear your customizations.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPreset(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-foreground">Cancel</button>
              <button onClick={() => applyPreset(confirmPreset)} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">Switch to {confirmPreset.charAt(0).toUpperCase() + confirmPreset.slice(1)}</button>
            </div>
          </div>
        </div>
      )}
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
  const { send: flowSend } = useFlow();
  const { user, isAuthenticated, fullName, notifications, updateNotifications, updateDisplayName, signOut } = useApp();
  const [editName, setEditName] = useState(toTitleCase(fullName || ""));
  const [nameSaved, setNameSaved] = useState(false);
  const nameSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setEditName(toTitleCase(fullName || "")); }, [fullName]);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET)) {
      const { tone, preset } = deriveOnboardingDefaults();
      if (notifications.defaultTone === "Friendly") {
        updateNotifications({ ...notifications, defaultTone: tone });
      }
      try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, preset); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveName() {
    const trimmed = toTitleCase(editName.trim());
    if (trimmed === toTitleCase(fullName || "")) return;
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

  function toggleSection(key: SectionKey) { setOpenSection((prev) => (prev === key ? null : key)); }

  async function handleSignOut() { await signOut(); navigate("/onboarding", { replace: true }); }

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
    <div className="flex-1 overflow-auto pb-24 pt-[env(safe-area-inset-top,0px)] animate-page-enter">
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <NotificationBell />
        </div>

        {isAuthenticated && (
          <>
            {/* ACCOUNT */}
            <SectionLabel>Account</SectionLabel>
            <div className="bg-card border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 rounded-xl shrink-0">
                  <AvatarImage src={user?.user_metadata?.avatar_url} className="rounded-xl object-cover" />
                  <AvatarFallback className="rounded-xl bg-accent">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </AvatarFallback>
                </Avatar>
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
                    : ent.isActive ? `Active • renews ${ent.nextBillingDate?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? ""}`
                    : ent.isPastDue ? "Payment past due"
                    : ent.status === "canceled" ? "Canceled"
                    : ent.status === "expired" ? "Restart Your Trial"
                    : "Manage subscription"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        )}

        {/* PREFERENCES */}
        <SectionLabel>Preferences</SectionLabel>
        <div className="flex flex-col gap-3 mb-5">
          <CollapsibleSection
            title="Notifications"
            subtitle="Email alerts and reminders"
            isOpen={openSection === "notifications"}
            onToggle={() => toggleSection("notifications")}
          >
            <NotificationsSection
              notifications={notifications}
              updateNotifications={(n) => {
                const turningOn = !notifications.autoChase && n.autoChase;
                const turningOff = notifications.autoChase && !n.autoChase;
                updateNotifications(n);
                if (turningOn) requestLocalNotificationPermission();
                if (turningOff) cancelAllPending();
              }}
            />
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

        {isAuthenticated && (
          <>
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
          </>
        )}

        {/* HELP */}
        <SectionLabel>Help</SectionLabel>
        <div className="bg-card border border-border rounded-2xl mb-5">
          <button
            onClick={() => flowSend("REPLAY_TOUR")}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Replay product tour</p>
              <p className="text-xs text-muted-foreground mt-0.5">Walk through ChaseHQ's key features again</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
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

        {isAuthenticated && (
          <div className="flex items-center justify-center mt-4 mb-4">
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        )}
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
