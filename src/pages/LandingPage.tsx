import { useLayoutEffect } from "react";
import Hero from "./landing/Hero";
import DreadVsRelief from "./landing/DreadVsRelief";
import HowItWorks from "./landing/HowItWorks";
import InteractiveDemo from "./landing/InteractiveDemo";
import TrustStrip from "./landing/TrustStrip";
import FinalCTA from "./landing/FinalCTA";
import Footer from "./landing/Footer";

// Inline keyframes + reveal-on-scroll classes. Lives inside the component so
// the iOS WebView CSS file (`src/index.css`, with its mobile body-lock) is
// untouched. Honors prefers-reduced-motion: the `.reveal` opacity reset is
// scoped under `@media (prefers-reduced-motion: no-preference)`.
const LANDING_STYLES = `
  html, body, #root { height: auto !important; overflow: auto !important; }
  body { overscroll-behavior-y: none; }

  @media (prefers-reduced-motion: no-preference) {
    .reveal { opacity: 0; transform: translateY(18px); transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1); }
    .reveal.is-revealed { opacity: 1; transform: translateY(0); }
  }

  @keyframes device-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
  .animate-device-float { animation: device-float 4s ease-in-out infinite; }
`;

export default function LandingPage() {
  useLayoutEffect(() => {
    // Mark Hero's reveal-tagged children as revealed on first paint so the
    // hero is visible immediately (IntersectionObserver only fires after layout).
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>("[data-eager-reveal] .reveal").forEach((el) => {
        el.classList.add("is-revealed");
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <style>{LANDING_STYLES}</style>
      <main>
        <div data-eager-reveal>
          <Hero />
        </div>
        <DreadVsRelief />
        <HowItWorks />
        <InteractiveDemo />
        <TrustStrip />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
