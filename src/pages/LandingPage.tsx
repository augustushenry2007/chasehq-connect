import { useLayoutEffect } from "react";
import Hero from "./landing/Hero";
import DreadVsRelief from "./landing/DreadVsRelief";
import HowItWorks from "./landing/HowItWorks";
import TrustStrip from "./landing/TrustStrip";
import FinalCTA from "./landing/FinalCTA";
import Footer from "./landing/Footer";
import "./landing/landing.css";

function SiteNav() {
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

export default function LandingPage() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const root = document.getElementById("root");
    html.style.height = "auto";
    html.style.overflow = "auto";
    document.body.style.height = "auto";
    document.body.style.overflow = "auto";
    if (root) { root.style.height = "auto"; root.style.overflow = "auto"; }

    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>("[data-eager-reveal] .reveal").forEach((el) => {
        el.classList.add("is-revealed");
      });
    });

    return () => {
      html.style.height = "";
      html.style.overflow = "";
      document.body.style.height = "";
      document.body.style.overflow = "";
      if (root) { root.style.height = ""; root.style.overflow = ""; }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <SiteNav />
      <main>
        <div data-eager-reveal>
          <Hero />
        </div>
        <DreadVsRelief />
        <HowItWorks />
        <TrustStrip />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
