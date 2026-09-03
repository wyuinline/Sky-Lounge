import type { Database } from "@/lib/database.types";

/**
 * The vocabulary of the permission model, with no server dependencies, so
 * client components can render role and area names without dragging the
 * Supabase server client into the browser bundle.
 *
 * The types come from the database enums, so adding an area or a role in a
 * migration surfaces here as a type error rather than a silent omission.
 */
export type AccessArea = Database["public"]["Enums"]["access_area"];
export type AccessLevel = Database["public"]["Enums"]["access_level"];
export type UserRole = Database["public"]["Enums"]["user_role"];

export const accessLevelLabel: Record<AccessLevel, string> = {
  full: "Full",
  create: "Create",
  read: "Read",
  own: "Own record",
  none: "No access",
};

/** What each level actually permits, shown as help text in the matrix editor. */
export const accessLevelDescription: Record<AccessLevel, string> = {
  full: "Read, add, amend, and delete every record in this area.",
  create: "Read every record and add new ones, but not amend or delete.",
  read: "Read every record. No changes.",
  own: "Read only the records that belong to this person.",
  none: "The area is hidden and the database refuses access.",
};

export const accessLevelOrder: AccessLevel[] = ["full", "create", "read", "own", "none"];

export const accessAreaLabel: Record<AccessArea, string> = {
  fleet: "UAV fleet",
  maintenance: "Maintenance records",
  pilots: "Pilots & crew",
  training: "Training records",
  requests: "Flight requests",
  logs: "Flight logs",
  incidents: "Incidents & safety",
  audits: "Audits & findings",
  docs_general: "Documents — general",
  docs_restricted: "Documents — restricted",
  roc_a: "ROC-A certificates",
  notifications: "Notifications",
  users: "User management",
  permissions: "Roles & access matrix",
  personal_data: "Personal data (restricted)",
};

/** Display order for the matrix — grouped by the part of the operation. */
export const accessAreaOrder: AccessArea[] = [
  "fleet",
  "maintenance",
  "pilots",
  "training",
  "requests",
  "logs",
  "incidents",
  "audits",
  "docs_general",
  "docs_restricted",
  "roc_a",
  "notifications",
  "users",
  "permissions",
  // Last, because it is the one area most roles should hold nothing in: date
  // of birth and immigration status are PIPEDA-sensitive, and every read is
  // logged.
  "personal_data",
];

export const roleLabel: Record<UserRole, string> = {
  system_admin: "System Administrator",
  uav_admin: "UAV Administrator",
  uav_lead: "UAV Lead",
  auditor: "Auditor",
  pilot: "Pilot",
  read_only: "Read-only",
};

/** One line on what the role is for, shown under each column heading. */
export const roleDescription: Record<UserRole, string> = {
  system_admin: "Owns the portal itself — accounts, roles, and this matrix.",
  uav_admin: "Runs the UAV programme day to day across every area.",
  uav_lead: "Leads flying and airworthiness: fleet, maintenance, and missions.",
  auditor: "Reads the compliance record and raises findings.",
  pilot: "Flies. Sees their own credentials and files their own reports.",
  read_only: "Looks, does not touch.",
};

export const roleOrder: UserRole[] = [
  "system_admin",
  "uav_admin",
  "uav_lead",
  "auditor",
  "pilot",
  "read_only",
];

/**
 * Areas where "own record" means something.
 *
 * The policies only consult `can_read_own` for these; setting it anywhere else
 * would read as "no access" while looking like a deliberate grant, so the
 * matrix does not offer it.
 */
export const ownSupportedAreas: AccessArea[] = [
  "pilots",
  "training",
  "requests",
  "logs",
  "roc_a",
  "notifications",
];

/** The levels the matrix offers for an area, in cycle order. */
export function levelsForArea(area: AccessArea): AccessLevel[] {
  return ownSupportedAreas.includes(area)
    ? accessLevelOrder
    : accessLevelOrder.filter((l) => l !== "own");
}
