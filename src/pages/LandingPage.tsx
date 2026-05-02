import { useLayoutEffect } from "react";
import Hero from "./landing/Hero";
import DreadVsRelief from "./landing/DreadVsRelief";
import HowItWorks from "./landing/HowItWorks";
import InteractiveDemo from "./landing/InteractiveDemo";
import TrustStrip from "./landing/TrustStrip";
import FinalCTA from "./landing/FinalCTA";
import Footer from "./landing/Footer";
import "./landing/landing.css";

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
