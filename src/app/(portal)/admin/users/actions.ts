"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  if (!access) return { error: "You are not signed in." as const, userId: null };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to manage users." as const, userId: null };
  }
  return { error: null, userId: access.userId };
}

export async function updateUserRole(profileId: string, role: string) {
  const supabase = await createClient();
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  // Mirrors the database trigger, which is the real enforcement. Without this
  // rule, anyone who can assign roles can assign themselves System
  // Administrator and from there rewrite the access matrix.
  if (profileId === guard.userId) {
    return { error: "You cannot change your own role. Ask another administrator." };
  }

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

/**
 * Where invite and recovery links land. Supabase appends its own query string,
 * and the address must also be listed under Auth → URL Configuration →
 * Redirect URLs in the Supabase dashboard, or it silently falls back to the
 * project's Site URL.
 */
function authCallbackUrl(next: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/**
 * Invites someone by email.
 *
 * Creating an auth user is a service-role operation — there is deliberately no
 * way to do it with the browser's key, or anyone could mint accounts. The
 * invited person receives a link, sets their own password, and lands in the
 * portal; we never see or set it.
 *
 * The role is applied after the account exists, because the profile row is
 * created by a database trigger on auth.users and always starts as read_only.
 */
export async function inviteUser(email: string, role: string, fullName: string) {
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  const address = email.trim().toLowerCase();
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { error: "Enter a valid email address." };
  }

  const name = fullName.trim();
  const nextRole = parseEnum<UserRole>(role, roleOrder, "read_only");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, active")
    .eq("email", address)
    .maybeSingle();

  if (existing) {
    return {
      error: existing.active
        ? "That email already has an account. Change their role below instead."
        : "That email has a disabled account. Re-enable it below rather than inviting again.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Inviting people needs SUPABASE_SECRET_KEY to be set on the server. Ask whoever manages the deployment to add it.",
    };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(address, {
    data: name ? { full_name: name } : undefined,
    redirectTo: authCallbackUrl("/auth/update-password"),
  });

  if (error) {
    console.error("[invite]", error);
    // 422 covers "already registered" — possible if an auth user exists with no
    // profile row, which the check above cannot see.
    if (error.status === 422) return { error: "That email already has an account." };
    if (error.status === 429) {
      return { error: "Too many invitations sent just now. Wait a minute and try again." };
    }
    return { error: "Couldn't send that invitation. Try again, or check the email address." };
  }

  // The trigger on auth.users has already created the profile as read_only.
  if (data.user && nextRole !== "read_only") {
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", data.user.id);

    if (roleError) {
      return {
        error: `Invitation sent, but the role could not be set — they are read-only for now. ${safeErrorMessage(roleError, "role change")}`,
      };
    }
  }

  revalidatePath("/admin/users");
  return { error: null };
}

/**
 * Sends someone a password reset link.
 *
 * Deliberately not a "set their password" button: an administrator who can
 * read a colleague's password can also sign in as them, and the audit trail
 * stops meaning anything. This only starts the flow — they choose the password.
 */
export async function sendPasswordReset(profileId: string) {
  const guard = await requireAdmin();
  if (guard.error) return { error: guard.error };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("email, active")
    .eq("id", profileId)
    .single();

  if (!target?.email) return { error: "That account has no email address on file." };
  if (!target.active) {
    return { error: "That account is disabled. Re-enable it before sending a reset link." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(target.email, {
    redirectTo: authCallbackUrl("/auth/update-password"),
  });

  if (error) {
    console.error("[password reset]", error);
    if (error.status === 429) {
      return { error: "A reset link was sent recently. Wait a minute before sending another." };
    }
    return { error: "Couldn't send the reset link. Try again shortly." };
  }

  return { error: null };
}
