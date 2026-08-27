import { redirect } from "next/navigation";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import {
  OrganisationsPanel,
  type OrganisationRow,
} from "@/components/portal/platform/organisations-panel";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccess } from "@/lib/permissions";

/**
 * Platform administration.
 *
 * The only page in the portal that sees more than one operator, and it sees
 * almost nothing: names, addresses, and how many people are in each. There is
 * no route from here into anybody's fleet, crew or incidents, because there is
 * no policy that would permit one.
 *
 * It runs on the service role for exactly that reason — the caller belongs to
 * one organisation, and RLS would quite correctly hide the rest.
 */
export default async function PlatformPage() {
  const access = await getAccess();
  if (!access) redirect("/login");
  if (!access.isPlatformAdmin) redirect("/");

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <HeroBand
          eyebrow="Platform"
          title="Operators"
          subtitle="Create an operator and invite the person who will run it."
        />
        <Alert>
          <ShieldAlert className="size-4 text-[var(--status-warning)]" />
          <AlertTitle>Not configured on this deployment</AlertTitle>
          <AlertDescription>
            Managing operators needs <code className="font-mono text-xs">SUPABASE_SECRET_KEY</code>{" "}
            set. Until it is, the operators that already exist keep working normally — only this
            page is unavailable.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [{ data: organisations }, { data: people }] = await Promise.all([
    admin
      .from("organisations")
      .select("id, name, slug, legal_name, contact_email, active, created_at")
      .order("name"),
    // Counted here rather than in the query so an operator with nobody in it
    // still appears — which is precisely when it needs attention.
    admin.from("profiles").select("organisation_id, role, active"),
  ]);

  const rows: OrganisationRow[] = (organisations ?? []).map((organisation) => {
    const members = (people ?? []).filter(
      (p) => p.organisation_id === organisation.id && p.active,
    );
    return {
      id: organisation.id,
      name: organisation.name,
      slug: organisation.slug,
      legal_name: organisation.legal_name,
      contact_email: organisation.contact_email,
      active: organisation.active,
      created_at: organisation.created_at,
      member_count: members.length,
      admin_count: members.filter((m) => m.role === "system_admin" || m.role === "uav_admin")
        .length,
    };
  });

  const active = rows.filter((r) => r.active);
  const unstaffed = active.filter((r) => r.admin_count === 0);

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Platform"
        title="Operators"
        subtitle="Each one is a sealed tenancy: its own fleet, crew, records and audit trail, invisible to every other."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Active operators" value={String(active.length)} />
        <MetricTile
          label="Deactivated"
          value={String(rows.length - active.length)}
          tone="neutral"
        />
        <MetricTile
          label="Without an administrator"
          value={String(unstaffed.length)}
          tone={unstaffed.length > 0 ? "warning" : "good"}
        />
        <MetricTile
          label="People across all operators"
          value={String((people ?? []).filter((p) => p.active).length)}
        />
      </div>

      <OrganisationsPanel organisations={rows} />
    </div>
  );
}
