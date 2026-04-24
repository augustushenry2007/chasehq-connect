import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEYS } from "@/lib/storageKeys";

export async function startGoogleOAuth(redirectTo: string): Promise<{ error: Error | null }> {
  sessionStorage.setItem(STORAGE_KEYS.OAUTH_IN_PROGRESS, "1");
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      return { error };
    }
    return { error: null };
  } catch (e) {
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
    const err = e instanceof Error ? e : new Error("Unknown error");
    return { error: err };
  }
}
