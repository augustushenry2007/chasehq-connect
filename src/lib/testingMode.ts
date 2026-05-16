// Testing mode — when enabled, the app behaves like a fresh user every login:
// - onboarding always runs from step 0
// - no persisted onboarding answers, notifications, or schedule pre-fill
// - localStorage caches are cleared on every auth event
//
// In PRODUCTION builds the only way to enable it is VITE_TESTING_MODE=true at
// build time. The runtime toggles (?testing=1 URL param and the testing_mode
// localStorage key) are DEV-only — otherwise a stray ?testing=1 link would
// permanently strand a production user in fresh-user mode (the URL flag used to
// be written to localStorage, so it stuck across reloads).
//
// Dev toggles:
//   - ?testing=1 / ?testing=0 in the URL (sticky in dev — writes the localStorage flag)
//   - localStorage.setItem("testing_mode", "true" | "false")

import { STORAGE_KEYS } from "@/lib/storageKeys";

const KEY = "testing_mode";

function readUrlFlag(): boolean | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("testing") === "1") {
    try { localStorage.setItem(KEY, "true"); } catch {}
    return true;
  }
  if (params.get("testing") === "0") {
    try { localStorage.setItem(KEY, "false"); } catch {}
    return false;
  }
  return null;
}

export function isTestingMode(): boolean {
  if (import.meta.env.VITE_TESTING_MODE === "true") return true;
  // Production builds ignore the URL param and the persisted localStorage key —
  // those are reachable from untrusted input and used to stick forever.
  if (!import.meta.env.DEV) return false;
  const urlFlag = readUrlFlag();
  if (urlFlag !== null) return urlFlag;
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

// Keys we wipe to guarantee a fresh-user experience.
const VOLATILE_KEYS = [STORAGE_KEYS.ONBOARDING_STATE, "notifications", "schedule"];

export function clearTestingState() {
  try {
    for (const k of VOLATILE_KEYS) localStorage.removeItem(k);
  } catch {}
}
