import { roleLabel, type UserRole } from "@/lib/access";

export type { UserRole };

/** Retained name for the role display map; the model itself lives in access.ts. */
export const roleLabels = roleLabel;

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
};
