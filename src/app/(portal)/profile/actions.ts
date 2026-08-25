"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/action-utils";

/**
 * Updates the signed-in user's own profile.
 *
 * Only fields a person owns are writable. Role is deliberately absent: it is
 * an administrator's decision, and the database enforces that too — a trigger
 * rejects a role change from a non-admin, so this is defence in depth rather
 * than the only guard.
 */
export async function updateOwnProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You are not signed in." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!fullName) {
    return { error: "Enter your name." };
  }
  if (fullName.length > 120) {
    return { error: "That name is too long." };
  }

  // Scoped to the caller's own row; RLS would reject anything else anyway.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/profile");
  // The sidebar shows the name, so every page renders it.
  revalidatePath("/", "layout");
  return { error: null };
}
