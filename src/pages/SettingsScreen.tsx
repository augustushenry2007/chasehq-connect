import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, type ScheduleRow } from "@/context/AppContext";
import { ChevronDown, ChevronUp, RefreshCw, LogOut, Plus, Trash2, Mail, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { toast } from "sonner";

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

function NotificationsSection({ notifications, updateNotifications }: {
  notifications: { emailNotifications: boolean; autoChase: boolean; defaultTone: string }; updateNotifications: (n: any) => void;
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
    const next = schedule.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    updateSchedule(next);
  }
  function removeRow(idx: number) {
    updateSchedule(schedule.filter((_, i) => i !== idx));
  }
  function addRow() {
    const lastDay = schedule.length > 0 ? Math.max(...schedule.map((r) => r.day)) : 0;
    updateSchedule([
      ...schedule,
      { id: Date.now(), day: lastDay + 7, action: "New reminder", status: "reminder-2" },
    ]);
  }

  return (
    <div className="flex flex-col gap-2">
      {schedule.map((row, i) => (
        <div key={row.id} className="flex items-center gap-2 p-2.5 bg-muted rounded-xl">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">Day</span>
            <input
              type="number"
              min={0}
              value={row.day}
              onChange={(e) => updateRow(i, { day: parseInt(e.target.value) || 0 })}
              className="w-14 px-2 py-1 text-xs font-bold text-primary bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <input
            type="text"
            value={row.action}
            onChange={(e) => updateRow(i, { action: e.target.value })}
            className="flex-1 px-2.5 py-1.5 text-sm text-foreground bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => removeRow(i)}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remove step"
          >
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
  const { notifications, schedule, updateNotifications, updateSchedule, signOut, restartOnboarding } = useApp();
  const [openSection, setOpenSection] = useState<SectionKey>(null);
  const { gmail, loading: gmailLoading, connectGmail, disconnectGmail } = useGmailConnection();
  const [gmailConnecting, setGmailConnecting] = useState(false);

  function toggleSection(key: SectionKey) {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  function handleSignOut() {
    signOut();
    navigate("/auth", { replace: true });
  }

  function handleRestartOnboarding() {
    restartOnboarding();
    navigate("/onboarding", { replace: true });
  }

  async function handleConnectGmail() {
    setGmailConnecting(true);
    const result = await connectGmail();
    if (result.error) {
      toast.error(result.error);
      setGmailConnecting(false);
    }
    // If successful, the page will redirect to Google
  }

  async function handleDisconnectGmail() {
    await disconnectGmail();
    toast.success("Gmail disconnected");
  }

  return (
    <div className="flex-1 overflow-auto pb-24">
      <div className="px-5 pt-5">
        <h1 className="text-xl font-bold text-foreground mb-4">Settings</h1>

        <div className="flex flex-col gap-3">
          {/* Gmail Connection Card */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Gmail</p>
                {gmailLoading ? (
                  <p className="text-xs text-muted-foreground">Checking connection…</p>
                ) : gmail.connected ? (
                  <p className="text-xs text-primary">Connected as {gmail.email}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Connect to send follow-ups from your Gmail</p>
                )}
              </div>
              {gmailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : gmail.connected ? (
                <button onClick={handleDisconnectGmail} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive">
                  Disconnect
                </button>
              ) : (
                <button onClick={handleConnectGmail} disabled={gmailConnecting} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50">
                  {gmailConnecting ? "Connecting…" : "Connect"}
                </button>
              )}
            </div>
          </div>

          <CollapsibleSection title="Notifications & Chasing" subtitle="Email alerts and auto-follow-up settings" isOpen={openSection === "notifications"} onToggle={() => toggleSection("notifications")}>
            <NotificationsSection notifications={notifications} updateNotifications={updateNotifications} />
          </CollapsibleSection>

          <CollapsibleSection title="Follow-Up Schedule" subtitle="Customize when each follow-up fires" isOpen={openSection === "schedule"} onToggle={() => toggleSection("schedule")}>
            <ScheduleSection schedule={schedule} updateSchedule={updateSchedule} />
          </CollapsibleSection>
        </div>

        <div className="flex items-center justify-center gap-3 mt-8 mb-4">
          <button onClick={handleRestartOnboarding} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" /> Restart onboarding
          </button>
          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
