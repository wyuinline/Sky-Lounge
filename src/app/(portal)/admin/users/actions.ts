"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { roleOrder, type UserRole } from "@/lib/access";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The roles that currently hold full authority over user management.
 *
 * Read from role_permissions rather than hardcoded, so that changing the
 * matrix immediately changes who counts as an administrator here. A database
 * trigger guarantees at least one role always keeps this level.
 */
async function userManagerRoles(supabase: Supabase): Promise<UserRole[]> {
  const { data } = await supabase
    .from("role_permissions")
    .select("role")
    .eq("area", "users")
    .eq("level", "full");
  return (data ?? []).map((r) => r.role);
}

/**
 * How many people can still sign in and administer.
 *
 * Used to stop the app removing the last one. A locked-out organisation can
 * only be recovered through the SQL editor, which is a bad afternoon.
 */
async function activeAdminCount(supabase: Supabase, managerRoles: UserRole[]): Promise<number> {
  if (managerRoles.length === 0) return 0;
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("role", managerRoles)
    .eq("active", true);
  return count ?? 0;
}

async function requireAdmin() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to manage users." as const };
  }
  return { error: null };
}

export async function updateUserRole(profileId: string, role: string) {
  const supabase = await createClient();
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  const nextRole = parseEnum<UserRole>(role, roleOrder, "read_only");

  const { data: target } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", profileId)
    .single();

  if (!target) return { error: "That account no longer exists." };

  // Demoting the last active administrator would leave nobody able to manage
  // roles through the portal at all.
  const managerRoles = await userManagerRoles(supabase);
  const losingAdmin =
    managerRoles.includes(target.role) && target.active && !managerRoles.includes(nextRole);
  if (losingAdmin && (await activeAdminCount(supabase, managerRoles)) <= 1) {
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
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  const { data: target } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", profileId)
    .single();

  if (!target) return { error: "That account no longer exists." };

  if (!active && target.active) {
    const managerRoles = await userManagerRoles(supabase);
    if (
      managerRoles.includes(target.role) &&
      (await activeAdminCount(supabase, managerRoles)) <= 1
    ) {
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
  const guard = await requireAdmin();
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
