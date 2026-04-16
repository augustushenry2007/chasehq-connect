import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, type ScheduleRow, type Integration } from "@/context/AppContext";
import { ChevronDown, ChevronUp, RefreshCw, LogOut } from "lucide-react";

type SectionKey = "profile" | "notifications" | "schedule" | "integrations" | null;

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

function ProfileSection({ profile, updateProfile }: {
  profile: { name: string; email: string; paymentDetails: string }; updateProfile: (p: any) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [paymentDetails, setPaymentDetails] = useState(profile.paymentDetails);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    updateProfile({ name, email, paymentDetails });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3.5">
      {[
        { label: "Display name", value: name, onChange: setName },
        { label: "Email", value: email, onChange: setEmail },
      ].map((f) => (
        <div key={f.label}>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
          <input value={f.value} onChange={(e) => f.onChange(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      ))}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment details</label>
        <textarea value={paymentDetails} onChange={(e) => setPaymentDetails(e.target.value)} rows={2} className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} className={`px-5 py-2 rounded-xl text-sm font-semibold text-primary-foreground ${saved ? "bg-[#16A34A]" : "bg-primary"}`}>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
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
          <div>
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </div>
          <button
            onClick={() => updateNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
            className={`w-11 h-6 rounded-full transition-colors relative ${notifications[item.key] ? "bg-primary" : "bg-border"}`}
          >
            <span className={`absolute w-5 h-5 bg-primary-foreground rounded-full top-0.5 transition-transform ${notifications[item.key] ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </button>
        </div>
      ))}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Default tone</p>
        <div className="flex gap-1.5">
          {tones.map((t) => (
            <button
              key={t}
              onClick={() => updateNotifications({ ...notifications, defaultTone: t })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${notifications.defaultTone === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
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
  return (
    <div className="flex flex-col gap-2">
      {schedule.map((row, i) => (
        <div key={row.id} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
          <span className="text-xs font-bold text-primary w-12">Day {row.day}</span>
          <span className="text-sm text-foreground flex-1">{row.action}</span>
        </div>
      ))}
    </div>
  );
}

function IntegrationRow({ integration, onToggle }: { integration: Integration; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-border last:border-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0" style={{ backgroundColor: integration.color }}>
        {integration.initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{integration.name}</p>
        <p className="text-xs text-muted-foreground">{integration.description}</p>
        {integration.connected && integration.lastSynced && (
          <p className="text-xs text-primary mt-0.5">Synced {integration.lastSynced}</p>
        )}
      </div>
      <button
        onClick={onToggle}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${integration.connected ? "bg-destructive/10 text-destructive" : "bg-primary text-primary-foreground"}`}
      >
        {integration.connected ? "Disconnect" : "Connect"}
      </button>
    </div>
  );
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { profile, notifications, schedule, integrations, updateProfile, updateNotifications, updateSchedule, toggleIntegration, signOut, restartOnboarding } = useApp();
  const [openSection, setOpenSection] = useState<SectionKey>(null);

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

  return (
    <div className="flex-1 overflow-auto pb-24">
      <div className="px-5 pt-5">
        <h1 className="text-xl font-bold text-foreground mb-4">Settings</h1>

        <div className="flex flex-col gap-3">
          <CollapsibleSection title="Profile" subtitle={`${profile.name} · ${profile.email}`} isOpen={openSection === "profile"} onToggle={() => toggleSection("profile")}>
            <ProfileSection profile={profile} updateProfile={updateProfile} />
          </CollapsibleSection>

          <CollapsibleSection title="Notifications & Chasing" subtitle="Email alerts and auto-follow-up settings" isOpen={openSection === "notifications"} onToggle={() => toggleSection("notifications")}>
            <NotificationsSection notifications={notifications} updateNotifications={updateNotifications} />
          </CollapsibleSection>

          <CollapsibleSection title="Follow-Up Schedule" subtitle="Customize when each follow-up fires" isOpen={openSection === "schedule"} onToggle={() => toggleSection("schedule")}>
            <ScheduleSection schedule={schedule} updateSchedule={updateSchedule} />
          </CollapsibleSection>

          <CollapsibleSection title="Integrations" subtitle={`${integrations.filter(i => i.connected).length} active connection${integrations.filter(i => i.connected).length !== 1 ? "s" : ""}`} isOpen={openSection === "integrations"} onToggle={() => toggleSection("integrations")}>
            <div className="-mx-4 -mb-4">
              {integrations.map((integ) => (
                <IntegrationRow key={integ.id} integration={integ} onToggle={() => toggleIntegration(integ.id)} />
              ))}
            </div>
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
