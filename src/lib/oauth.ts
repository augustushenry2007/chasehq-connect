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
      // Double-rAF: the second callback fires after WebKit has completed at least one full
      // paint cycle, guaranteeing the OAuthOverlay (committed via flushSync) is in the
      // compositor frame buffer before GoogleAuth.signIn() triggers the native modal.
      // iOS takes a WKWebView snapshot at modal-present time — this ensures it snapshots
      // the overlay, not the underlying route.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = await GoogleAuth.signIn();
      // Assert overlay immediately after native dialog closes — before any subsequent awaits.
      // Guards against browserFinished clearing OAUTH_IN_PROGRESS between SVC close and
      // signInWithIdToken completing; also re-shows the overlay if briefly dismissed.
      sessionStorage.setItem(STORAGE_KEYS.OAUTH_COMPLETED, "1");
      window.dispatchEvent(new Event("chasehq:oauth-signal"));

      const { data: sessionData, error: idError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: result.idToken,
      });
      if (idError || !sessionData.session) {
        sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
        window.dispatchEvent(new Event("chasehq:oauth-signal"));
        console.error("[startGoogleOAuth native] signInWithIdToken failed:", idError);
        return { error: idError ?? new Error("Sign-in failed") };
      }

      // signInWithIdToken does not populate session.provider_token, so AppContext's
      // SIGNED_IN gmail-upsert silently no-ops. Persist tokens here BEFORE navigating
      // — downstream screens (paywall, send) need this row present.
      const expiresAt = result.accessTokenExpiresAt
        || new Date(Date.now() + 55 * 60 * 1000).toISOString();
      const { error: gmailError } = await supabase.from("gmail_connections").upsert({
        user_id: sessionData.session.user.id,
        email: sessionData.session.user.email ?? result.email,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        token_expires_at: expiresAt,
      }, { onConflict: "user_id" });
      if (gmailError) {
        console.error("[startGoogleOAuth native] gmail_connections upsert failed:", gmailError);
      }

      sessionStorage.setItem(STORAGE_KEYS.OAUTH_COMPLETED, "1");
      // Keep OAUTH_IN_PROGRESS="1" through pushState so OAuthOverlay cannot dismiss
      // while pathname is still /guest-draft (before the URL update lands).
      let targetPath = "/auth-after-invoice";
      try {
        const u = new URL(redirectTo);
        targetPath = u.pathname + u.search;
      } catch {
        if (redirectTo.startsWith("/")) targetPath = redirectTo;
      }
      window.history.pushState({}, "", targetPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      window.dispatchEvent(new Event("chasehq:oauth-signal"));
      return { error: null };
    } catch (e: unknown) {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
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
        scopes: "openid email profile https://www.googleapis.com/auth/gmail.send",
        queryParams: { access_type: "offline", prompt: "consent" },
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
