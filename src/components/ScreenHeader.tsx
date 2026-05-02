import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  title?: string;
  onBack?: () => void;
  fallbackPath?: string;
  rightSlot?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, fallbackPath = "/dashboard", rightSlot }: Props) {
  const navigate = useNavigate();
  const back = onBack ?? (() => {
    if (window.history.length > 1) window.history.back();
    else navigate(fallbackPath);
  });
  return (
    <header className="flex items-center gap-2 px-4 pt-[max(env(safe-area-inset-top,12px),12px)] pb-3">
      <button
        type="button"
        onClick={back}
        aria-label="Back"
        className="min-w-11 min-h-11 -ml-2 inline-flex items-center justify-center rounded-lg text-foreground active:scale-95 active:bg-muted/60 transition"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      {title && <h1 className="text-base font-semibold text-foreground">{title}</h1>}
      <div className="ml-auto">{rightSlot}</div>
    </header>
  );
}
