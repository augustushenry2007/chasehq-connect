import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEYS } from "@/lib/storageKeys";

// Sentinel attached to errors when the user dismisses the GIDSignIn dialog.
// Callers check `error.code === OAUTH_USER_CANCELED` to suppress error toasts.
export const OAUTH_USER_CANCELED = "USER_CANCELED";

export async function startGoogleOAuth(
  redirectTo: string,
  intent: "signIn" | "signUp" = "signUp",
): Promise<{ error: (Error & { code?: string }) | null }> {
  if (intent === "signIn") {
    sessionStorage.setItem(STORAGE_KEYS.SIGN_IN_INTENT, "1");
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.SIGN_IN_INTENT);
  }
  sessionStorage.setItem(STORAGE_KEYS.OAUTH_IN_PROGRESS, "1");
  window.dispatchEvent(new Event("chasehq:oauth-signal"));

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const { GoogleAuth } = await import("@/lib/googleNativeAuth");
      // Set COMPLETED before the native modal opens so that Capacitor Browser's
      // browserFinished event — which fires when GIDSignIn's internal browser closes,
      // before GoogleAuth.signIn() resolves — always sees COMPLETED="1" and is a no-op.
      sessionStorage.setItem(STORAGE_KEYS.OAUTH_COMPLETED, "1");
      // Double-rAF: the second callback fires after WebKit has completed at least one full
      // paint cycle, guaranteeing the OAuthOverlay (committed via flushSync) is in the
      // compositor frame buffer before GoogleAuth.signIn() triggers the native modal.
      // iOS takes a WKWebView snapshot at modal-present time — this ensures it snapshots
      // the overlay, not the underlying route.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = await GoogleAuth.signIn();
      window.dispatchEvent(new Event("chasehq:oauth-signal")); // re-assert overlay after dialog closes

      // Bound signInWithIdToken with an explicit 15s timeout. iOS WKWebView's fetch
      // transport has no built-in timeout — without this race, a flaky network silently
      // hangs the auth flow forever, which previously cascaded into PostInvoiceAuthScreen's
      // 15s escape-hatch reload (and the user landing back on AuthForm).
      const idTokenSignIn = supabase.auth.signInWithIdToken({
        provider: "google",
        token: result.idToken,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("signInWithIdToken timed out after 15s")),
          15000,
        ),
      );
      let sessionData: Awaited<ReturnType<typeof supabase.auth.signInWithIdToken>>["data"] = { session: null, user: null };
      let idError: Error | null = null;
      try {
        const r = await Promise.race([idTokenSignIn, timeoutPromise]);
        sessionData = r.data;
        idError = r.error;
      } catch (e) {
        idError = e instanceof Error ? e : new Error("Sign-in failed");
      }
      if (idError || !sessionData.session) {
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
        window.dispatchEvent(new Event("chasehq:oauth-signal"));
        console.error("[startGoogleOAuth native] signInWithIdToken failed:", idError);
        return { error: idError ?? new Error("Sign-in failed") };
      }

      // Auth complete — release the splash gate immediately.
      sessionStorage.setItem(STORAGE_KEYS.OAUTH_COMPLETED, "1");
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      window.dispatchEvent(new Event("chasehq:oauth-signal"));

      // Gmail link is a side-effect that does not gate app access.
      // Fire-and-forget: failure falls back to Settings → Reconnect Gmail.
      if (result.serverAuthCode) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        fetch(`${supabaseUrl}/functions/v1/gmail-link-from-auth-code`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionData.session.access_token}`,
            "apikey": apikey,
          },
          body: JSON.stringify({ serverAuthCode: result.serverAuthCode }),
        })
          .then(async (linkRes) => {
            if (!linkRes.ok) {
              const body = await linkRes.json().catch(() => ({}));
              console.error("[startGoogleOAuth] gmail-link-from-auth-code failed:", linkRes.status, body);
            }
          })
          .catch((e) => console.error("[startGoogleOAuth] Gmail link failed:", e));
      }

      return { error: null };
    } catch (e: unknown) {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
      window.dispatchEvent(new Event("chasehq:oauth-signal"));
      const code = (e as { code?: string })?.code;
      const err: Error & { code?: string } = e instanceof Error ? e : new Error("Sign-in failed");
      if (code) err.code = code;
      console.error("[startGoogleOAuth native] failed:", err.message, code);
      return { error: err };
    }
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "openid email profile",
      },
    });

    if (error || !data?.url) {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      console.error("[startGoogleOAuth] supabase error", error);
      return { error: error ?? new Error("No OAuth URL returned") };
    }

    return { error: null };
  } catch (e) {
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
    console.error("[startGoogleOAuth] threw:", e);
    const err = e instanceof Error ? e : new Error("Sign-in failed");
    return { error: err };
  }
}
