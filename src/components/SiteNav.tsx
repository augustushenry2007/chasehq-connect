import appLogo from "@/assets/app-logo.png";

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={appLogo} alt="ChaseHQ" className="h-8 w-8 rounded-xl" />
          <span className="text-[24px] font-bold tracking-[-0.03em] text-foreground select-none">
            Chase<span className="text-primary">HQ</span>
          </span>
        </div>
      </div>
    </header>
  );
}
