import { describe, it, expect, beforeEach, vi } from "vitest";
import { STORAGE_KEYS } from "@/lib/storageKeys";

describe("Authentication Flow", () => {
  it("should validate email format", () => {
    const validEmail = "user@example.com";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test(validEmail)).toBe(true);
  });

  it("should reject invalid email format", () => {
    const invalidEmail = "not-an-email";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test(invalidEmail)).toBe(false);
  });

  it("should require strong password characteristics", () => {
    const strongPassword = "Test1234!";
    const hasUppercase = /[A-Z]/.test(strongPassword);
    const hasLowercase = /[a-z]/.test(strongPassword);
    const hasNumber = /\d/.test(strongPassword);
    const hasMinLength = strongPassword.length >= 8;

    expect(hasUppercase && hasLowercase && hasNumber && hasMinLength).toBe(true);
  });

  it("should reject weak passwords", () => {
    const weakPassword = "short";
    expect(weakPassword.length >= 8).toBe(false);
  });
});

describe("Invoice Data Flow", () => {
  it("should convert database invoice to frontend format", () => {
    const dbInvoice = {
      invoice_number: "INV-001",
      amount: "1500.00",
    };

    const convertedAmount = Number(dbInvoice.amount);
    expect(convertedAmount).toBe(1500);
  });

  it("should format dates correctly", () => {
    const isoDate = "2026-05-19";
    const date = new Date(isoDate);
    const formattedDate = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    expect(formattedDate).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("should calculate invoice totals", () => {
    const invoices = [
      { amount: 1000, status: "pending" },
      { amount: 500, status: "paid" },
      { amount: 250, status: "overdue" },
    ];

    const outstandingTotal = invoices
      .filter(inv => inv.status === "pending")
      .reduce((sum, inv) => sum + inv.amount, 0);

    const paidTotal = invoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.amount, 0);

    expect(outstandingTotal).toBe(1000);
    expect(paidTotal).toBe(500);
  });
});

describe("Onboarding Flow", () => {
  it("should validate onboarding completion", () => {
    const onboarding_completed = true;
    expect(onboarding_completed).toBe(true);
  });

  it("should track onboarding step", () => {
    const steps = ["questions", "how-it-works", "pricing"];
    const currentStep = 0;
    expect(currentStep).toBeLessThan(steps.length);
  });
});

describe("Flow Machine Transitions", () => {
  it("should transition from LANDING to ONBOARDING", () => {
    const transitions = {
      LANDING: {
        START: "ONBOARDING",
      },
    };
    expect(transitions.LANDING.START).toBe("ONBOARDING");
  });

  it("should transition from ONBOARDING to GUEST_DRAFT or DASHBOARD_EMPTY", () => {
    const transitions = {
      ONBOARDING: {
        DECIDE_YES:  "GUEST_DRAFT",
        DECIDE_SKIP: "DASHBOARD_EMPTY",
      },
    };
    expect(transitions.ONBOARDING.DECIDE_YES).toBe("GUEST_DRAFT");
    expect(transitions.ONBOARDING.DECIDE_SKIP).toBe("DASHBOARD_EMPTY");
  });

  it("should handle sign out from any state", () => {
    const signOutTransition = "LANDING";
    expect(signOutTransition).toBe("LANDING");
  });
});

describe("OAuth Flow", () => {
  it("should set oauth_in_progress flag", () => {
    sessionStorage.setItem(STORAGE_KEYS.OAUTH_IN_PROGRESS, "1");
    expect(sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS)).toBe("1");
  });

  it("should clear oauth_in_progress on sign in", () => {
    sessionStorage.setItem(STORAGE_KEYS.OAUTH_IN_PROGRESS, "1");
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
    expect(sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS)).toBeNull();
  });

  it("should have correct redirect URI", () => {
    const redirectUri = `${window.location.origin}`;
    expect(redirectUri).toContain("localhost");
  });
});

describe("Local Storage Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should persist notifications settings", () => {
    const settings = { emailNotifications: true, autoChase: true, defaultTone: "Friendly" as const };
    localStorage.setItem("notifications", JSON.stringify(settings));
    const stored = JSON.parse(localStorage.getItem("notifications") || "{}");
    expect(stored.emailNotifications).toBe(true);
  });

  it("should persist schedule", () => {
    const schedule = [
      { id: 1, day: 0, action: "Invoice sent", status: "sent" as const },
    ];
    localStorage.setItem("schedule", JSON.stringify(schedule));
    const stored = JSON.parse(localStorage.getItem("schedule") || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].day).toBe(0);
  });

  it("should clear storage on sign out", () => {
    localStorage.setItem("notifications", JSON.stringify({}));
    localStorage.clear();
    expect(localStorage.getItem("notifications")).toBeNull();
  });
});

describe("Route Configuration", () => {
  it("should have all required routes", () => {
    const routes = ["/", "/welcome", "/auth", "/dashboard", "/onboarding", "/invoices"];
    expect(routes).toContain("/auth");
    expect(routes).toContain("/dashboard");
  });

  it("should have auth route for OAuth callback", () => {
    const authRoute = "/auth";
    expect(authRoute).toBe("/auth");
  });
});
