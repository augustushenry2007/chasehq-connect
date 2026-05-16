import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Returns true when the recipient is on the suppression list (unsubscribed,
// hard-bounced, or complained). Send paths short-circuit on true. Fails open
// (returns false) if the lookup errors — better to deliver a message that may
// have been suppressed than to silently break sends if the suppression table
// is briefly unavailable. Bounce/complaint webhook will catch the re-suppress
// on the next undeliverable send.
export async function isRecipientSuppressed(
  admin: SupabaseClient,
  recipient: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("email_suppressions")
    .select("recipient")
    .eq("recipient", recipient.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[suppression] lookup failed (failing open):", error.message);
    return false;
  }
  return !!data;
}
