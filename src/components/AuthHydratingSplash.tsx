import { Loader2 } from "lucide-react";
import appLogo from "@/assets/app-logo.png";

interface AuthHydratingSplashProps {
  fixed?: boolean;
}

export function AuthHydratingSplash({ fixed = false }: AuthHydratingSplashProps) {
  const containerClass = fixed
    ? "fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center px-6 overflow-hidden"
    : "h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden";
  return (
    <div className={containerClass}>
      <img src={appLogo} alt="ChaseHQ logo" className="w-20 h-20 rounded-2xl mb-4 shadow-sm" />
      <p className="text-sm font-bold tracking-[0.18em] text-primary mb-5">ChaseHQ</p>
      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
    </div>
  );
}
