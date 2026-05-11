import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, FileText, Settings } from "lucide-react";

const TABS = [
  { path: "/dashboard", label: "Dashboard", icon: Home },
  { path: "/invoices", label: "Follow-Ups", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function TabLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col bg-background">
      <Outlet />
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/60 z-40">
        <div className="flex items-center justify-around max-w-lg mx-auto pb-[env(safe-area-inset-bottom,8px)] pt-2">
          {TABS.map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="relative flex flex-col items-center gap-0.5 px-5 py-1"
              >
                <span
                  aria-hidden="true"
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-opacity ${isActive ? "bg-primary opacity-100" : "opacity-0"}`}
                />
                <tab.icon className={`w-[22px] h-[22px] transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
