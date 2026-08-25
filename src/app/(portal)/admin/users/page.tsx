import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  UsersTable,
  type PilotOption,
  type UserRow,
} from "@/components/portal/admin/users-table";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

export default async function UserManagementPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  // Server-side gate as well as RLS: an administrator-only page should not
  // render at all for anyone else, rather than rendering and failing on write.
  if (!profile) redirect("/login");
  if (profile.role !== "uav_admin") redirect("/");

  const [{ data: profiles }, { data: pilots }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, active").order("created_at"),
    supabase.from("pilots").select("id, full_name, profile_id").order("full_name"),
  ]);

  const pilotList = pilots ?? [];
  const linkByProfile = new Map(
    pilotList.filter((p) => p.profile_id).map((p) => [p.profile_id as string, p.id]),
  );

  const rows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role,
    active: p.active,
    linked_pilot_id: linkByProfile.get(p.id) ?? null,
  }));

  const pilotOptions: PilotOption[] = pilotList.map((p) => ({
    id: p.id,
    full_name: p.full_name,
  }));

  const admins = rows.filter((r) => r.role === "uav_admin" && r.active).length;
  const disabled = rows.filter((r) => !r.active).length;
  const unlinkedPilots = pilotList.filter((p) => !p.profile_id).length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Administration"
        title="User Management"
        subtitle="Assign roles, link pilot records to accounts, and control who can sign in."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Accounts" value={`${rows.length}`} tone="neutral" />
        <MetricTile label="Administrators" value={`${admins}`} tone={admins > 1 ? "good" : "warning"} />
        <MetricTile label="Disabled" value={`${disabled}`} tone="neutral" />
        <MetricTile
          label="Pilots Not Linked"
          value={`${unlinkedPilots}`}
          tone={unlinkedPilots > 0 ? "warning" : "good"}
        />
      </div>

      {admins <= 1 ? (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Only one administrator</AlertTitle>
          <AlertDescription>
            You are the only active administrator, so the portal will not let you give up the role
            or disable the account — that would leave nobody able to manage access. Promote a second
            administrator to remove that constraint.
          </AlertDescription>
        </Alert>
      ) : null}

      <UsersTable rows={rows} pilots={pilotOptions} currentUserId={profile.id} />

      <Alert>
        <ShieldCheck />
        <AlertTitle>How access works</AlertTitle>
        <AlertDescription>
          New accounts start as read-only. Linking a pilot record lets that person see their own
          certificate and recency details, and sends reminders about them to the individual as well
          as to the responsible role. Roles are enforced by the database, not just hidden in the
          interface, so a disabled or read-only account cannot write even outside this portal.
        </AlertDescription>
      </Alert>
    </div>
  );
}
