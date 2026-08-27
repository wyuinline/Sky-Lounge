"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeErrorMessage } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { authCallbackUrl } from "@/lib/auth-urls";
import { slugify, isValidSlug } from "@/lib/slug";

/**
 * Platform administration: bringing a new operator onto the portal.
 *
 * This is the one place in the application that reaches across organisations,
 * and it is deliberately narrow. It can create an operator and invite the
 * person who will run it. It cannot read a single row of anybody's operational
 * data — there is no policy anywhere that would let it, and none is added here.
 *
 * Everything below runs on the service role, because by definition the caller
 * does not belong to the organisation being created.
 */

async function requirePlatformAdmin() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const, access: null };
  if (!access.isPlatformAdmin) {
    return { error: "That is not something you can do." as const, access: null };
  }
  return { error: null, access };
}

export async function createOrganisation(formData: FormData) {
  const guard = await requirePlatformAdmin();
  if (guard.error) return { error: guard.error, id: null };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the operator a name.", id: null };

  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);
  if (!isValidSlug(slug)) {
    return {
      error: "That name does not make a usable web address. Set the address by hand.",
      id: null,
    };
  }

  const legalName = String(formData.get("legal_name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();

  // The caller's own session, not the service role: provision_organisation
  // checks is_platform_admin() against the signed-in user, and would refuse a
  // service-role call that has no user at all.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("provision_organisation", {
    p_name: name,
    p_slug: slug,
    p_legal_name: legalName || undefined,
    p_contact_email: contactEmail || undefined,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `The address "${slug}" is already taken. Choose another.`, id: null };
    }
    return { error: safeErrorMessage(error, "organisation"), id: null };
  }

  revalidatePath("/platform");
  return { error: null, id: data as string };
}

/**
 * Invites the person who will run a newly created operator.
 *
 * They arrive as a system administrator of their own organisation, which is
 * the only way the account is usable: there is nobody else there to grant them
 * anything.
 */
export async function inviteFirstAdmin(organisationId: string, email: string, fullName: string) {
  const guard = await requirePlatformAdmin();
  if (guard.error) return { error: guard.error };

  const address = email.trim().toLowerCase();
  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { error: "Enter a valid email address." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error: "Invitations need SUPABASE_SECRET_KEY set on this deployment.",
    };
  }

  const { data: organisation } = await admin
    .from("organisations")
    .select("id, name")
    .eq("id", organisationId)
    .maybeSingle();

  if (!organisation) return { error: "That organisation no longer exists." };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(address, {
    // The trigger on auth.users reads this to place the new profile. Without
    // it the account cannot be created at all, which is the intended failure.
    data: {
      organisation_id: organisation.id,
      ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
    },
    redirectTo: authCallbackUrl("/auth/update-password"),
  });

  if (error) {
    console.error("[platform invite]", error);
    if (error.status === 422) return { error: "That email already has an account." };
    if (error.status === 429) {
      return { error: "Too many invitations sent just now. Wait a minute and try again." };
    }
    return { error: "Could not send that invitation." };
  }

  if (data.user) {
    // The trigger created them as read_only. Somebody has to be able to run
    // the new operation, and there is nobody else yet to promote them.
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role: "system_admin", full_name: fullName.trim() || null })
      .eq("id", data.user.id);

    if (roleError) {
      console.error("[platform invite] could not set the first admin's role", roleError);
      return {
        error: `${address} was invited, but could not be made an administrator. Set their role once they accept.`,
      };
    }
  }

  revalidatePath("/platform");
  return { error: null };
}

export async function setOrganisationActive(organisationId: string, active: boolean) {
  const guard = await requirePlatformAdmin();
  if (guard.error) return { error: guard.error };

  // Deactivating is reversible and leaves every record intact. There is no
  // delete here on purpose: an operator's flight records are a legal document
  // for somebody, and removing them is not a button.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "This needs SUPABASE_SECRET_KEY set on this deployment." };
  }

  const { error } = await admin
    .from("organisations")
    .update({ active })
    .eq("id", organisationId);

  if (error) return { error: safeErrorMessage(error, "organisation") };

  revalidatePath("/platform");
  return { error: null };
}
