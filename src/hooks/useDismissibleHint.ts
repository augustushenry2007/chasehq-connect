import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";

export type HintKey = "tone_selector" | "generate_ai" | "chase_schedule" | "invoice_age";

// Session-level cache so dismissals propagate instantly within a page session
// without waiting for a DB round-trip to flow back through AppContext.
const _sessionDismissed = new Map<HintKey, boolean>();

interface UseDismissibleHintResult {
  shouldShow: boolean;
  dismiss: () => Promise<void>;
}

export function useDismissibleHint(key: HintKey): UseDismissibleHintResult {
  const { user, tourCompleted, dismissedHints } = useApp();

  const isDismissed =
    !tourCompleted ||
    _sessionDismissed.get(key) === true ||
    !!dismissedHints[key];

  const [dismissed, setDismissed] = useState(isDismissed);

  const dismiss = useCallback(async () => {
    _sessionDismissed.set(key, true);
    setDismissed(true);
    if (!user) return;
    const updated = { ...dismissedHints, [key]: true };
    await supabase
      .from("profiles")
      .update({ dismissed_hints: updated })
      .eq("user_id", user.id);
  }, [key, user, dismissedHints]);

  return { shouldShow: !dismissed, dismiss };
}
