export type UserRole =
  | "uav_admin"
  | "ops_manager"
  | "pilot"
  | "auditor"
  | "maintenance_team"
  | "read_only";

export const roleLabels: Record<UserRole, string> = {
  uav_admin: "UAV Administrator",
  ops_manager: "Operations Manager",
  pilot: "Pilot",
  auditor: "Auditor",
  maintenance_team: "Maintenance Team",
  read_only: "Read-only",
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
};
