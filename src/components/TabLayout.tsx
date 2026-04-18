import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, FileText, Settings } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useApp } from "@/context/AppContext";

const TABS = [
  { path: "/dashboard", label: "Dashboard", icon: Home },
  { path: "/invoices", label: "Invoices", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function TabLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useApp();

  return (
    <div className="h-screen flex flex-col bg-background">
      {isAuthenticated && (
        <div className="fixed top-0 right-0 z-40 pt-[env(safe-area-inset-top,8px)] pr-3">
          <NotificationBell />
        </div>
      )}
      <Outlet />
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border z-40">
        <div className="flex items-center justify-around max-w-lg mx-auto pb-[env(safe-area-inset-bottom,8px)] pt-2">
          {TABS.map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex flex-col items-center gap-0.5 px-5 py-1"
              >
                <tab.icon className={`w-[22px] h-[22px] ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
