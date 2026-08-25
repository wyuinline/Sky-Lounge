"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import type { UserRole } from "@/lib/types";

const ROLES = [
  "uav_admin",
  "ops_manager",
  "pilot",
  "auditor",
  "maintenance_team",
  "read_only",
] as const;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * How many administrators can still sign in and administer.
 *
 * Used to stop the app removing the last one. A locked-out organisation can
 * only be recovered through the SQL editor, which is a bad afternoon.
 */
async function activeAdminCount(supabase: Supabase): Promise<number> {
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "uav_admin")
    .eq("active", true);
  return count ?? 0;
}

async function requireAdmin(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are not signed in." as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "uav_admin") {
    return { error: "Only administrators can manage users." as const };
  }
  return { error: null, userId: user.id };
}

export async function updateUserRole(profileId: string, role: string) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (guard.error) return { error: guard.error };

  const nextRole = parseEnum<UserRole>(role, ROLES, "read_only");

  const { data: target } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", profileId)
    .single();

  if (!target) return { error: "That account no longer exists." };

  // Demoting the last active administrator would leave nobody able to manage
  // roles through the portal at all.
  const losingAdmin = target.role === "uav_admin" && target.active && nextRole !== "uav_admin";
  if (losingAdmin && (await activeAdminCount(supabase)) <= 1) {
    return {
      error: "This is the last active administrator. Promote someone else first.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: nextRole })
    .eq("id", profileId);

  if (error) return { error: safeErrorMessage(error, "role change") };

  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
  return { error: null };
}

export async function setUserActive(profileId: string, active: boolean) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (guard.error) return { error: guard.error };

  const { data: target } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", profileId)
    .single();

  if (!target) return { error: "That account no longer exists." };

  if (!active && target.role === "uav_admin" && target.active) {
    if ((await activeAdminCount(supabase)) <= 1) {
      return {
        error: "This is the last active administrator. Promote someone else first.",
      };
    }
  }

  const { error } = await supabase.from("profiles").update({ active }).eq("id", profileId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/admin/users");
  return { error: null };
}

/**
 * Links a pilot record to a user account, or clears the link.
 *
 * This is what makes pilots.profile_id meaningful: it lets a pilot see their
 * own record under RLS, and lets reminders reach the individual rather than
 * only the responsible role.
 */
export async function linkPilotToProfile(profileId: string, pilotId: string | null) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (guard.error) return { error: guard.error };

  // A profile owns at most one pilot record, so clear any previous link first.
  const { error: clearError } = await supabase
    .from("pilots")
    .update({ profile_id: null })
    .eq("profile_id", profileId);

  if (clearError) return { error: safeErrorMessage(clearError, "update") };

  if (pilotId) {
    const { error } = await supabase
      .from("pilots")
      .update({ profile_id: profileId })
      .eq("id", pilotId);

    if (error) return { error: safeErrorMessage(error, "update") };
  }

  revalidatePath("/admin/users");
  revalidatePath("/pilots");
  return { error: null };
}
