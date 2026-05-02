import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  float?: boolean;
  className?: string;
};

// iPhone-shaped frame. Static SVG-equivalent border + notch, no images.
export default function MockDevice({ children, float = false, className = "" }: Props) {
  return (
    <div
      className={`relative mx-auto w-[260px] sm:w-[280px] aspect-[9/19] ${
        float ? "animate-device-float motion-reduce:animate-none" : ""
      } ${className}`}
    >
      <div className="absolute inset-0 rounded-[42px] bg-foreground/90 shadow-[0_20px_60px_-20px_rgba(68,127,152,0.45)]" />
      <div className="absolute inset-[6px] rounded-[36px] bg-background overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-foreground/90 rounded-b-2xl z-10" />
        <div className="absolute inset-0 pt-7">{children}</div>
      </div>
    </div>
  );
}
