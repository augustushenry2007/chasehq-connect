export default function Footer() {
  return (
    <footer className="px-6 py-10 border-t border-border">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">ChaseHQ</p>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <a href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="/legal/terms" className="hover:text-foreground transition-colors">Terms</a>
          <a href="mailto:support@chasehq.app" className="hover:text-foreground transition-colors">Contact</a>
        </nav>
        <p className="text-xs text-muted-foreground">© 2026 ChaseHQ</p>
      </div>
    </footer>
  );
}
