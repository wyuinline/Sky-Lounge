"use server";

import { createClient } from "@/lib/supabase/server";

const MIN_LENGTH = 10;

/**
 * Sets the signed-in person's own password.
 *
 * Reached with a session already established by the emailed link, so the only
 * authority needed is that session — an administrator never handles the value.
 */
export async function updatePassword(password: string, confirmation: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "That link has expired. Ask for a new one and try again." };
  }

  if (password !== confirmation) {
    return { error: "The two passwords don't match." };
  }

  if (password.length < MIN_LENGTH) {
    return { error: `Use at least ${MIN_LENGTH} characters.` };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("[update password]", error);
    // Supabase rejects passwords found in breach corpora when the project has
    // that check on; the message is worth passing through, unlike most.
    if (error.message.toLowerCase().includes("weak") || error.status === 422) {
      return { error: "That password is too easy to guess. Try a longer, less common one." };
    }
    return { error: "Couldn't set that password. Try again." };
  }

  return { error: null };
}
