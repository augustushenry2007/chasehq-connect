import AppStoreBadge from "./AppStoreBadge";
import HeroPhoneDemo from "./HeroPhoneDemo";

export default function Hero() {
  return (
    <section className="relative px-6 pt-14 pb-24 sm:pt-16 sm:pb-28 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-accent/40 via-accent/15 to-transparent pointer-events-none" />
      <div className="relative max-w-6xl mx-auto">

        {/* Wordmark */}
        <div className="inline-flex items-center gap-2.5 mb-16 sm:mb-20">
          <span className="text-[22px] font-bold tracking-[-0.025em] text-foreground">ChaseHQ</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-14 lg:gap-16 items-center">
          {/* Copy */}
          <div className="reveal">
            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-2 bg-accent/60 text-primary px-3 py-1.5 rounded-full text-[13px] font-medium mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_0_3px_rgba(34,197,94,0.20)]" />
              Now on iPhone
            </div>

            <h1 className="text-[clamp(42px,5.6vw,68px)] font-bold text-foreground tracking-[-0.035em] leading-[1.02] mb-5">
              Stop chasing.
              <span className="text-primary block">Start getting paid.</span>
            </h1>
            <p className="text-[18px] text-muted-foreground leading-[1.55] max-w-[480px] mb-9">
              Most freelancers aren't bad at business. They dread the follow-up. ChaseHQ writes every follow-up for you — in your tone, on your schedule.
            </p>
            <div className="flex flex-col items-start gap-2.5">
              <AppStoreBadge size="lg" />
              <p className="text-[13px] text-muted-foreground ml-1">iPhone · Free to start</p>
            </div>
          </div>

          {/* Device mockup */}
          <div className="reveal flex justify-center lg:justify-end">
            <div className="relative flex justify-center">
              {/* Glow */}
              <div className="absolute inset-[8%_12%] bg-gradient-radial from-accent/60 to-transparent blur-[60px] rounded-full" />
              {/* Phone shell */}
              <div
                className="relative w-[388px] h-[836px] bg-[#0E1B22] rounded-[54px] p-3 z-10"
                style={{ boxShadow: "0 60px 120px rgba(0,0,0,0.45), 0 20px 40px rgba(26,43,53,0.30), 0 0 0 1px rgba(255,255,255,0.07), inset 0 0 0 1px rgba(255,255,255,0.04)" }}
                aria-label="ChaseHQ iPhone app demo showing the full follow-up workflow"
                role="img"
              >
                {/* Side buttons */}
                <div style={{ position: "absolute", left: -10, top: 132, width: 10, height: 22, background: "#080f16", borderRadius: "3px 0 0 3px", boxShadow: "-2px 0 4px rgba(0,0,0,0.7)" }} />
                <div style={{ position: "absolute", left: -10, top: 188, width: 10, height: 46, background: "#080f16", borderRadius: "3px 0 0 3px", boxShadow: "-2px 0 4px rgba(0,0,0,0.7)" }} />
                <div style={{ position: "absolute", left: -10, top: 252, width: 10, height: 46, background: "#080f16", borderRadius: "3px 0 0 3px", boxShadow: "-2px 0 4px rgba(0,0,0,0.7)" }} />
                <div style={{ position: "absolute", right: -10, top: 228, width: 10, height: 72, background: "#080f16", borderRadius: "0 3px 3px 0", boxShadow: "2px 0 4px rgba(0,0,0,0.7)" }} />
                {/* Floating animation */}
                <style>{`@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
                <div style={{ animation: "floaty 4s ease-in-out infinite", width: "100%", height: "100%" }}>
                  {/* Screen */}
                  <div className="w-full h-full bg-[#F7F9FA] rounded-[42px] overflow-hidden flex flex-col relative">
                    {/* Dynamic Island */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[35px] bg-[#0E1B22] rounded-full z-10" />
                    {/* Status bar */}
                    <div className="flex justify-between items-center px-8 pt-[14px] pb-1 text-[13px] font-semibold text-[#1A2B35] shrink-0">
                      <span>9:41</span>
                      <span className="inline-flex gap-1 items-center">
                        <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M1 7.5C3 5 5.5 4 8 4s5 1 7 3.5L14 9c-1.5-2-3.5-3-6-3s-4.5 1-6 3L1 7.5z" fill="#1A2B35"/></svg>
                        <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><rect x="0" y="3" width="3" height="6" rx="0.5" fill="#1A2B35"/><rect x="4" y="2" width="3" height="7" rx="0.5" fill="#1A2B35"/><rect x="8" y="1" width="3" height="8" rx="0.5" fill="#1A2B35"/><rect x="12" y="0" width="3" height="9" rx="0.5" fill="#1A2B35"/></svg>
                        <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x="0.5" y="0.5" width="18" height="9" rx="2" stroke="#1A2B35" fill="none"/><rect x="2" y="2" width="14" height="6" rx="1" fill="#1A2B35"/><rect x="19.5" y="3" width="1.5" height="4" rx="0.75" fill="#1A2B35"/></svg>
                      </span>
                    </div>

                    {/* Animated demo screens */}
                    <div className="flex-1 overflow-hidden">
                      <HeroPhoneDemo />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
