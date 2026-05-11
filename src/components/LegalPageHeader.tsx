import appLogo from "@/assets/app-logo.png";

export function LegalPageHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 select-none hover:opacity-80 transition-opacity">
          <img src={appLogo} alt="ChaseHQ" className="w-[30px] h-[30px] rounded-[7px]" />
          <span className="text-[22px] font-bold tracking-[-0.03em] text-foreground">
            Chase<span className="text-primary">HQ</span>
          </span>
        </a>
        <a href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to home
        </a>
      </div>
    </header>
  );
}
