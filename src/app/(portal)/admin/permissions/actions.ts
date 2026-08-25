"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import {
  accessAreaOrder,
  levelsForArea,
  roleOrder,
  type AccessArea,
  type AccessLevel,
  type UserRole,
} from "@/lib/access";

/**
 * Changes what a role is allowed to do in one area.
 *
 * The database policies read this same table, so a change here takes effect
 * everywhere immediately — including outside the portal. That is the point:
 * the matrix is the access control, not a picture of it.
 */
export async function setRolePermission(role: string, area: string, level: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("users")) {
    return { error: "Only a role with full access to user management can edit this matrix." };
  }

  const nextRole = parseEnum<UserRole>(role, roleOrder, "read_only");
  const nextArea = parseEnum<AccessArea>(area, accessAreaOrder, "fleet");
  const allowed = levelsForArea(nextArea);
  const nextLevel = parseEnum<AccessLevel>(level, allowed, "none");

  if (nextRole !== role || nextArea !== area || nextLevel !== level) {
    return { error: "That is not a permission this portal recognises." };
  }

  // Taking user management away from your own role locks you out of this page,
  // and only a database console could put it back. The trigger downstream only
  // guarantees *some* role keeps it, which is not the same thing.
  if (nextArea === "users" && nextRole === access.role && nextLevel !== "full") {
    return {
      error:
        "That would remove your own access to user management. Grant it to another role first, then change yours.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("role_permissions")
    .update({ level: nextLevel })
    .eq("role", nextRole)
    .eq("area", nextArea);

  if (error) return { error: safeErrorMessage(error, "permission change") };

  // Permissions gate the sidebar and every page, so the whole shell is stale.
  revalidatePath("/", "layout");
  return { error: null };
}
