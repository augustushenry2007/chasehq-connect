import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useInvoices } from "@/hooks/useSupabaseData";
import { getStats, getChaseFeed, formatUSD } from "@/lib/data";
import { useApp } from "@/context/AppContext";
import { StatusBadge, STATUS_CONFIG } from "@/components/StatusBadge";
import { useFlow } from "@/flow/FlowMachine";
import { startGoogleOAuth } from "@/lib/oauth";
import {
  TrendingUp, AlertTriangle, CheckCircle, Check,
  Plus, FileText, Sparkles, Clock, Mail, Pen,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import NewInvoiceModal from "@/components/invoice/NewInvoiceModal";
import TrialBanner from "@/components/TrialBanner";
import NotificationBell from "@/components/NotificationBell";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useSendingMailbox } from "@/hooks/useSendingMailbox";
import { mailboxPromptShownKey, displayNamePromptShownKey } from "@/lib/storageKeys";

function StatCard({ label, value, sub, icon: Icon, iconColor, valueColor, onClick }: {
  label: string; value: string; sub: string; icon: React.ElementType; iconColor: string; valueColor?: string; onClick?: () => void;
}) {
  const interactive = !!onClick;
  const Elem = interactive ? "button" : "div";
  return (
    <Elem
      {...(interactive ? { onClick } : { "aria-disabled": true })}
      className={`flex-1 bg-card border border-border rounded-2xl p-4 text-left transition-colors ${interactive ? "hover:border-primary/40 active:scale-[0.98]" : "cursor-default"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${interactive ? "" : "opacity-50"}`} style={{ color: valueColor || "hsl(var(--foreground))" }}>{value}</p>
      <p className={`text-xs text-muted-foreground mt-0.5 ${interactive ? "" : "opacity-50"}`}>{sub}</p>
    </Elem>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { user, fullName, isAuthenticated, profileReady, updateDisplayName } = useApp();
  const { invoices, loading, refetch } = useInvoices();
  const { send: flowSend } = useFlow();
  const { signedInWithGoogle, connectGmail } = useGmailConnection();
  const { canSend: hasMailbox, loading: mailboxLoading } = useSendingMailbox();
  const [showNew, setShowNew] = useState(false);
  const [mailboxPromptOpen, setMailboxPromptOpen] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [promptName, setPromptName] = useState("");

  useEffect(() => {
    if (!isAuthenticated || mailboxLoading || hasMailbox) return;
    const key = mailboxPromptShownKey(user?.id);
    if (localStorage.getItem(key)) return;
    setMailboxPromptOpen(true);
  }, [isAuthenticated, mailboxLoading, hasMailbox, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !profileReady || fullName) return;
    const email = user?.email || "";
    const localPart = email.split("@")[0].split("+")[0].toLowerCase().replace(/[._-]/g, "");
    const genericNames = new Set(["billing", "info", "hello", "contact", "admin", "support", "noreply", "notifications", "mail", "team", "help", "accounts", "invoice", "invoices", "payments"]);
    if (!genericNames.has(localPart)) return;
    const key = displayNamePromptShownKey(user?.id);
    if (localStorage.getItem(key)) return;
    setNamePromptOpen(true);
  }, [isAuthenticated, profileReady, fullName, user?.id, user?.email]);

  function handleDismissMailboxPrompt() {
    localStorage.setItem(mailboxPromptShownKey(user?.id), "1");
    setMailboxPromptOpen(false);
  }

  function handleConnectMailbox() {
    localStorage.setItem(mailboxPromptShownKey(user?.id), "1");
    setMailboxPromptOpen(false);
    if (signedInWithGoogle) {
      connectGmail("/dashboard");
    } else {
      navigate("/settings");
    }
  }

  const stats = getStats(invoices);
  const chaseFeed = getChaseFeed(invoices);
  const isEmpty = invoices.length === 0;

  if (loading) {
    return (
      <div className="flex-1 overflow-hidden pb-24">
        <div className="px-5 pt-5">
          <div className="h-6 w-48 bg-muted rounded-md animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded-md animate-pulse mt-2" />
          <div className="flex gap-3 mt-5">
            <div className="flex-1 h-24 bg-card border border-border rounded-2xl animate-pulse" />
            <div className="flex-1 h-24 bg-card border border-border rounded-2xl animate-pulse" />
          </div>
          <div className="mt-3 h-24 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="mt-5 h-40 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="mt-4 h-32 bg-card border border-border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const firstName = fullName?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0];
  const greetingText = firstName ? `${greeting()}, ${firstName}` : greeting();

  return (
    <div className="flex-1 overflow-auto pb-24 animate-page-enter">
      <TrialBanner />
      {!isAuthenticated && (
        <div className="mx-5 mt-4 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-4">
          <p className="text-sm font-bold text-foreground">Finish setting up your account</p>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">Sign up to keep your invoices and start sending follow-ups.</p>
          <button
            onClick={async () => {
              flowSend("REQUEST_POST_INVOICE_AUTH");
              const { error } = await startGoogleOAuth(window.location.origin + "/auth-after-invoice");
              if (error) toast.error("Sign-in didn't go through. Give it another try.");
            }}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
          >
            Create free account
          </button>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            By continuing, you grant ChaseHQ permission to send emails from your Gmail address on your behalf. We never read your inbox.
          </p>
        </div>
      )}
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">
              {greetingText}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEmpty ? "Add your first invoice — we'll take the hardest part off your plate." : "Here's what needs your attention today."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isEmpty && (
              <button
                onClick={() => { flowSend("CREATE_INVOICE"); setShowNew(true); }}
                aria-label="New invoice"
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <NotificationBell />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <StatCard
            label="Outstanding"
            value={formatUSD(stats.outstandingTotal)}
            sub={isEmpty ? "Add an invoice to get started" : `${stats.outstandingCount} invoices`}
            icon={TrendingUp}
            iconColor="#3B82F6"
            onClick={isEmpty ? undefined : () => navigate("/invoices")}
          />
          <StatCard
            label="Overdue"
            value={formatUSD(stats.overdueTotal)}
            sub={isEmpty ? "Nothing overdue" : `${stats.overdueCount} need action`}
            icon={AlertTriangle}
            iconColor="#F59E0B"
            valueColor={stats.overdueCount > 0 ? "#DC2626" : undefined}
            onClick={isEmpty ? undefined : () => navigate("/invoices?filter=overdue")}
          />
          <StatCard
            label="Total Collected"
            value={formatUSD(stats.paidTotal)}
            sub={isEmpty ? "No payments yet" : `${stats.paidCount} invoices paid`}
            icon={CheckCircle}
            iconColor="#22C55E"
            valueColor={stats.paidCount > 0 ? "#16A34A" : undefined}
            onClick={isEmpty ? undefined : () => navigate("/invoices?filter=paid")}
          />
          <StatCard
            label="Upcoming"
            value={formatUSD(stats.upcomingTotal)}
            sub={isEmpty ? "No invoices yet" : `${stats.upcomingCount} invoices`}
            icon={Clock}
            iconColor="#6366F1"
            onClick={isEmpty ? undefined : () => navigate("/invoices?filter=upcoming")}
          />
        </div>
      </div>

      {isEmpty ? (
        <>
          {/* Empty-state hero */}
          <div className="mt-5 mx-5 bg-card border border-border rounded-2xl p-5 relative overflow-hidden animate-fade-in">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Ready to create your first follow-up?</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Add an invoice to ChaseHQ and we'll draft personalized follow-ups in your tone. Send them on your schedule.
              </p>
              <button
                onClick={() => { flowSend("CREATE_INVOICE"); setShowNew(true); }}
                className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.97]"
              >
                <Plus className="w-4 h-4" /> Add your first invoice
              </button>
            </div>
          </div>

          {/* What ChaseHQ does */}
          <div className="mx-5 mt-3 bg-card border border-border rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">What Happens Next</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                "We draft every follow-up in your tone — no blank screens.",
                "Reminders queue on the schedule you set in Settings.",
                "You review and send each one — nothing goes out without you.",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* All caught up state */}
          {chaseFeed.length === 0 && (
            <div className="mt-5 mx-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">All caught up</p>
                <p className="text-xs text-muted-foreground mt-0.5">No outstanding follow-ups right now.</p>
              </div>
            </div>
          )}

          {/* Chase Feed */}
          {chaseFeed.length > 0 && (
            <div className="mt-5 mx-5 bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Chase Feed</h2>
                  <p className="text-xs text-muted-foreground">Prioritized actions</p>
                </div>
                <button onClick={() => navigate("/invoices")} className="text-sm font-medium text-primary">View all</button>
              </div>
              {chaseFeed.map((inv, i) => (
                <button
                  key={inv.id}
                  onClick={() => navigate(`/invoice/${inv.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${i < chaseFeed.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG[inv.status]?.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{inv.client}</span>
                      <span className="text-xs text-muted-foreground">{inv.id}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {inv.daysPastDue > 0 ? `${inv.daysPastDue} days overdue` : inv.description}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground shrink-0">{formatUSD(inv.amount)}</span>
                </button>
              ))}
            </div>
          )}

        </>
      )}

      <NewInvoiceModal visible={showNew} onClose={() => setShowNew(false)} onCreated={refetch} />

      <AlertDialog open={namePromptOpen} onOpenChange={setNamePromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pen className="w-4 h-4 text-primary" />
              How should we sign your follow-ups?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your email address alone won't look great at the bottom of a follow-up. Add your name so every message ends with a personal touch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={promptName}
            onChange={(e) => setPromptName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && promptName.trim()) {
                updateDisplayName(promptName.trim());
                try { localStorage.setItem(displayNamePromptShownKey(user?.id), "1"); } catch {}
                setNamePromptOpen(false);
              }
            }}
            placeholder="e.g. Alex or Alex from Studio"
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              try { localStorage.setItem(displayNamePromptShownKey(user?.id), "1"); } catch {}
            }}>
              Skip for now
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!promptName.trim()}
              onClick={() => {
                if (!promptName.trim()) return;
                updateDisplayName(promptName.trim());
                try { localStorage.setItem(displayNamePromptShownKey(user?.id), "1"); } catch {}
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={mailboxPromptOpen} onOpenChange={setMailboxPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Connect your Gmail to send
            </AlertDialogTitle>
            <AlertDialogDescription>
              {signedInWithGoogle
                ? "ChaseHQ needs permission to send from your Gmail. We never read your inbox. You can connect anytime from Settings → Gmail."
                : "Connect your Gmail account in Settings so ChaseHQ can send follow-ups on your behalf."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDismissMailboxPrompt}>Skip for now</AlertDialogCancel>
            <AlertDialogAction onClick={handleConnectMailbox}>
              {signedInWithGoogle ? "Connect Gmail" : "Open Settings"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
