import { useState } from "react";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { MirrorBlocker } from "@/lib/userProfile/types";

const MIRROR_OPTIONS: { id: MirrorBlocker; label: string }[] = [
  { id: "dread",         label: "Dreading the follow-up before I've even written it" },
  { id: "overthinking",  label: "Overthinking every word so I don't seem pushy" },
  { id: "avoidance",     label: "Putting it off until it feels too late to ask" },
  { id: "letting_slide", label: "Letting invoices slide because I hate the whole thing" },
];

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

function readEarlySelections(): MirrorBlocker[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.EARLY_MIRROR_SELECTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set<MirrorBlocker>(["dread", "overthinking", "avoidance", "letting_slide"]);
    return parsed.filter((x): x is MirrorBlocker => typeof x === "string" && valid.has(x as MirrorBlocker));
  } catch {
    return [];
  }
}

// Rendered inside OAuthOverlay during sign-up: shows slide 1 ("The Mirror")
// interactively while auth completes in the background. Selections are persisted
// to sessionStorage so OnboardingScreen can pre-populate its own mirrorTypes state.
export function EarlyMirrorSlide() {
  const [sel, setSel] = useState<MirrorBlocker[]>(readEarlySelections);

  function handleToggle(id: MirrorBlocker) {
    const next = toggle(sel, id);
    setSel(next);
    try {
      sessionStorage.setItem(STORAGE_KEYS.EARLY_MIRROR_SELECTIONS, JSON.stringify(next));
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto overscroll-contain">
      {/* Minimal progress rail — empty, matching OnboardingScreen header layout */}
      <div className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,16px)] pb-3">
        <div className="w-9 h-9 opacity-0 pointer-events-none" aria-hidden="true" />
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: "0%" }} />
        </div>
        <div className="w-9 h-9 opacity-0 pointer-events-none" aria-hidden="true" />
      </div>

      <div className="px-5 pb-[max(env(safe-area-inset-bottom,16px),24px)]">
        <div className="card-elevated p-5 mt-2">
          <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Real quick</span>
          <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">
            Which of these sounds like you?
          </h2>
          <p className="text-[15px] text-muted-foreground mb-5">Pick everything that fits.</p>
          <div className="flex flex-col gap-2.5">
            {MIRROR_OPTIONS.map((opt) => {
              const selected = sel.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => handleToggle(opt.id)}
                  className={`relative text-left px-4 py-3.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-accent/40 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30 hover:shadow-[var(--shadow-card)]"}`}
                >
                  <p className="text-sm font-semibold text-foreground pr-6">{opt.label}</p>
                  {selected && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
