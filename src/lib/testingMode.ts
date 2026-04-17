// Testing mode — when enabled, the app behaves like a fresh user every login:
// - onboarding always runs from step 0
// - no persisted onboarding answers, notifications, or schedule pre-fill
// - localStorage caches are cleared on every auth event
//
// Toggle via:
//   1. VITE_TESTING_MODE=true at build time, OR
//   2. localStorage.setItem("testing_mode", "true") at runtime, OR
//   3. ?testing=1 in the URL (sticky — sets the localStorage flag)
//
// Disable with: localStorage.setItem("testing_mode", "false")  (or remove the key)

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
  const urlFlag = readUrlFlag();
  if (urlFlag !== null) return urlFlag;
  if (import.meta.env.VITE_TESTING_MODE === "true") return true;
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

// Keys we wipe to guarantee a fresh-user experience.
const VOLATILE_KEYS = ["onboarding_state", "notifications", "schedule"];

export function clearTestingState() {
  try {
    for (const k of VOLATILE_KEYS) localStorage.removeItem(k);
  } catch {}
}
