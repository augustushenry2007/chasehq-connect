import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDismissibleHint, type HintKey } from "@/hooks/useDismissibleHint";

// Global ref: only one hint is open at a time across all CoachHint instances.
let _activeHintKey: HintKey | null = null;
const _listeners = new Set<() => void>();
function setActiveHint(key: HintKey | null) {
  _activeHintKey = key;
  _listeners.forEach((fn) => fn());
}

interface CoachHintProps {
  hintKey: HintKey;
  title: string;
  body: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

export function CoachHint({ hintKey, title, body, side = "top", children }: CoachHintProps) {
  const { shouldShow, dismiss } = useDismissibleHint(hintKey);
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1);
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  }, []);

  useEffect(() => {
    if (!mountedRef.current && shouldShow && _activeHintKey === null) {
      mountedRef.current = true;
      // Small delay so the underlying UI has painted before the popover opens.
      const t = setTimeout(() => setActiveHint(hintKey), 400);
      return () => clearTimeout(t);
    }
  }, [shouldShow, hintKey]);

  const isOpen = shouldShow && _activeHintKey === hintKey;

  async function handleDismiss() {
    setActiveHint(null);
    await dismiss();
  }

  if (!shouldShow) return <>{children}</>;

  return (
    <Popover open={isOpen} onOpenChange={(open) => { if (!open) void handleDismiss(); }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} className="w-64 p-0" sideOffset={8}>
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
          <button
            onClick={handleDismiss}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Got it
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
