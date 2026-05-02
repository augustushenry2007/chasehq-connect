import { Lock, MailCheck, EyeOff } from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

const POINTS = [
  { Icon: Lock, label: "Your data stays yours." },
  { Icon: MailCheck, label: "Gmail send-only access." },
  { Icon: EyeOff, label: "No tracking pixels." },
];

export default function TrustStrip() {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <section className="px-6 py-16 sm:py-20">
      <div ref={ref} className="reveal max-w-4xl mx-auto text-center">
        <p className="text-base sm:text-lg text-muted-foreground">
          Built for freelancers, designers, and one-person studios.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center items-center">
          {POINTS.map(({ Icon, label }) => (
            <div key={label} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="w-4 h-4 text-primary" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
