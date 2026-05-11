import { useLayoutEffect } from "react";
import Hero from "./landing/Hero";
import DreadVsRelief from "./landing/DreadVsRelief";
import HowItWorks from "./landing/HowItWorks";
import FinalCTA from "./landing/FinalCTA";
import Footer from "./landing/Footer";
import SiteNav from "@/components/SiteNav";
import "./landing/landing.css";

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
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
