import { supabase } from "@/integrations/supabase/client";

/**
 * Run an async action; if it fails with an auth/RLS error, silently refresh the
 * session and retry once. Never surface "session expired" to the user.
 */
export async function withAuthRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (isAuthError(err)) {
      try {
        await supabase.auth.refreshSession();
      } catch {
        /* ignore — fall through to retry which will throw a friendlier error */
      }
      return await action();
    }
    throw err;
  }
}

function isAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; status?: number; message?: string };
  if (e.code === "PGRST301" || e.code === "401") return true;
  if (e.status === 401) return true;
  if (typeof e.message === "string" && /jwt|token|auth|session/i.test(e.message)) return true;
  return false;
}
