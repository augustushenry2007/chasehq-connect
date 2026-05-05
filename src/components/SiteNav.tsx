export default function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between">
        <span className="text-[26px] font-bold tracking-[-0.03em] text-foreground select-none">
          Chase<span className="text-primary">HQ</span>
        </span>
        <a
          href="https://apps.apple.com"
          className="inline-flex items-center gap-1.5 bg-primary text-white text-[13px] font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
        >
          Download Free
        </a>
      </div>
    </header>
  );
}
