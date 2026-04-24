import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Inbox } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow, differenceInCalendarDays, isValid } from "date-fns";

function formatUpcomingDate(iso: string): string {
  const d = new Date(iso);
  if (!isValid(d)) return "";
  const days = differenceInCalendarDays(d, new Date());
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, upcoming, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  function handleTap(n: { id: string; invoice_id: string }) {
    markRead(n.id);
    setOpen(false);
    navigate(`/invoice/${n.invoice_id}`);
  }

  const hasRecent = notifications.length > 0;
  const hasUpcoming = upcoming.length > 0;
  const isEmpty = !hasRecent && !hasUpcoming;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative p-2 rounded-lg hover:bg-muted transition-colors active:scale-[0.92] duration-150"
        >
          <Bell className="w-5 h-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between space-y-0">
          <SheetTitle>Notifications</SheetTitle>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs font-medium text-primary mr-6">
              Mark all read
            </button>
          )}
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-100px)]">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Inbox className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground mt-1">Reminders show up here on due dates and follow-up days.</p>
            </div>
          ) : (
            <>
              {/* Upcoming section */}
              {hasUpcoming && (
                <div className="mb-2">
                  <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-1.5 px-1">Upcoming</p>
                  <div className="flex flex-col gap-1">
                    {upcoming.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => { setOpen(false); navigate(`/invoice/${n.invoice_id}`); }}
                        className="text-left p-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground flex-1 truncate">{n.title}</p>
                          <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                            {formatUpcomingDate(n.scheduled_for)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent section */}
              {hasRecent && (
                <div>
                  {hasUpcoming && (
                    <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase mb-1.5 px-1 mt-2">Recent</p>
                  )}
                  <div className="flex flex-col gap-1">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleTap(n)}
                        className={`text-left p-3 rounded-xl border transition-colors ${
                          n.status === "delivered"
                            ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                            : "bg-card border-border hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground flex-1">{n.title}</p>
                          {n.status === "delivered" && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          {(() => { const d = new Date(n.scheduled_for); return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "recently"; })()}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
