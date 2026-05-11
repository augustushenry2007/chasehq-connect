import AppStoreBadge from "./AppStoreBadge";
import HeroPhoneDemo from "./HeroPhoneDemo";

export default function Hero() {
  return (
    <section className="relative px-6 pt-12 pb-24 sm:pt-14 sm:pb-28 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-accent/40 via-accent/15 to-transparent pointer-events-none" />
      <div className="relative max-w-6xl mx-auto">

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

          {/* Device mockup — pure CSS iPhone-15-Pro frame */}
          <div className="reveal flex justify-center lg:justify-end">
            <div className="relative flex justify-center">
              {/* Glow */}
              <div className="absolute inset-[8%_12%] bg-gradient-radial from-accent/60 to-transparent blur-[60px] rounded-full" />

              <style>{`@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>

              {/* Outer titanium frame */}
              <div
                className="relative w-[360px] h-[740px] rounded-[58px] z-10"
                style={{
                  background: "linear-gradient(160deg,#2a2a2c 0%,#0e0e10 55%,#1a1a1c 100%)",
                  padding: "12px",
                  boxShadow:
                    "0 80px 160px rgba(0,0,0,0.55), 0 30px 60px rgba(0,0,0,0.35), 0 0 0 1.5px rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.05)",
                  animation: "floaty 4s ease-in-out infinite",
                }}
                aria-label="ChaseHQ iPhone app demo showing the follow-up workflow"
                role="img"
              >
                {/* Side buttons */}
                <div style={{ position: "absolute", left: -3, top: 120, width: 3, height: 26, borderRadius: "2px 0 0 2px", background: "linear-gradient(to right,#3a3a3c,#1f1f21)" }} />
                <div style={{ position: "absolute", left: -3, top: 178, width: 3, height: 54, borderRadius: "2px 0 0 2px", background: "linear-gradient(to right,#3a3a3c,#1f1f21)" }} />
                <div style={{ position: "absolute", left: -3, top: 244, width: 3, height: 54, borderRadius: "2px 0 0 2px", background: "linear-gradient(to right,#3a3a3c,#1f1f21)" }} />
                <div style={{ position: "absolute", right: -3, top: 220, width: 3, height: 84, borderRadius: "0 2px 2px 0", background: "linear-gradient(to left,#3a3a3c,#1f1f21)" }} />

                {/* Inner screen */}
                <div className="relative w-full h-full bg-[#F7F9FA] rounded-[46px] overflow-hidden flex flex-col">
                  {/* Dynamic Island — single, clean, centered */}
                  <div
                    className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[110px] h-[32px] bg-black rounded-full z-20"
                    aria-hidden="true"
                  />

                  {/* Status bar */}
                  <div className="flex justify-between items-center px-7 pt-[14px] pb-1 text-[13px] font-semibold text-[#1A2B35] shrink-0 relative z-10">
                    <span>9:41</span>
                    <span className="inline-flex gap-1 items-center">
                      <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M1 7.5C3 5 5.5 4 8 4s5 1 7 3.5L14 9c-1.5-2-3.5-3-6-3s-4.5 1-6 3L1 7.5z" fill="#1A2B35"/></svg>
                      <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><rect x="0" y="3" width="3" height="6" rx="0.5" fill="#1A2B35"/><rect x="4" y="2" width="3" height="7" rx="0.5" fill="#1A2B35"/><rect x="8" y="1" width="3" height="8" rx="0.5" fill="#1A2B35"/><rect x="12" y="0" width="3" height="9" rx="0.5" fill="#1A2B35"/></svg>
                      <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x="0.5" y="0.5" width="18" height="9" rx="2" stroke="#1A2B35" fill="none"/><rect x="2" y="2" width="14" height="6" rx="1" fill="#1A2B35"/><rect x="19.5" y="3" width="1.5" height="4" rx="0.75" fill="#1A2B35"/></svg>
                    </span>
                  </div>

                  {/* Demo screens */}
                  <div className="flex-1 overflow-hidden">
                    <HeroPhoneDemo />
                  </div>

                  {/* Home indicator */}
                  <div className="shrink-0 flex justify-center py-2">
                    <div className="w-[100px] h-[4px] bg-[#1A2B35]/30 rounded-full" />
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
