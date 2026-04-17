import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface Props {
  children: ReactNode;
  /** 1-indexed step number for the dots; 0 hides them */
  step?: number;
  totalSteps?: number;
  showBack?: boolean;
  onBack?: () => void;
}

export default function QuickstartLayout({ children, step = 0, totalSteps = 5, showBack = false, onBack }: Props) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 pt-5 pb-2 flex items-center justify-between min-h-[44px]">
        {showBack ? (
          <button
            onClick={() => (onBack ? onBack() : navigate(-1))}
            className="-ml-2 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : <span />}
        {step > 0 && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 === step ? "w-6 bg-primary" : i + 1 < step ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
        )}
        <span className="w-7" />
      </header>
      <main className="flex-1 flex flex-col px-6 pb-8 max-w-md mx-auto w-full animate-fade-in">
        {children}
      </main>
    </div>
  );
}
