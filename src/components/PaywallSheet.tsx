import { useEffect } from "react";
import { createPortal } from "react-dom";
import PaywallContent from "@/components/PaywallContent";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PaywallSheet({ open, onOpenChange }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-3xl shadow-2xl animate-slide-in-up max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-muted rounded-full" />
        </div>
        <PaywallContent onClose={() => onOpenChange(false)} />
      </div>
    </div>,
    document.body,
  );
}
