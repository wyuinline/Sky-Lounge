import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { accessAreaOrder, type AccessArea, type AccessLevel, type UserRole } from "@/lib/access";

export * from "@/lib/access";

export type Access = {
  role: UserRole;
  levels: Record<AccessArea, AccessLevel>;
  /** Sees every record in the area. */
  canReadAll: (area: AccessArea) => boolean;
  /** May add records, though not necessarily amend anyone else's. */
  canCreate: (area: AccessArea) => boolean;
  /** Full authority: update and delete, not only insert. */
  canManage: (area: AccessArea) => boolean;
};

const NO_ACCESS = Object.fromEntries(
  accessAreaOrder.map((a) => [a, "none" as AccessLevel]),
) as Record<AccessArea, AccessLevel>;

/**
 * Loads the signed-in user's permissions.
 *
 * The same table the database policies read, so what the interface offers and
 * what the database permits cannot drift apart — hiding a button was never the
 * access control, and now it is not even a separate rule.
 *
 * Cached per request: the layout and the page it renders both need this, and
 * without the cache that is two round trips for the same answer.
 */
export const getAccess = cache(async function getAccess(): Promise<Access | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: permissions }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("role_permissions").select("role, area, level"),
  ]);

  const role = (profile?.role as UserRole) ?? "read_only";

  const levels = { ...NO_ACCESS };
  for (const row of permissions ?? []) {
    if (row.role === role) levels[row.area] = row.level;
  }

  return {
    role,
    levels,
    canReadAll: (area) => ["full", "create", "read"].includes(levels[area]),
    canCreate: (area) => ["full", "create"].includes(levels[area]),
    canManage: (area) => levels[area] === "full",
  };
});
