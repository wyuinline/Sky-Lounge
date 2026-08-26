import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PermissionsMatrix,
  type Matrix,
} from "@/components/portal/admin/permissions-matrix";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import {
  accessAreaOrder,
  roleDescription,
  roleLabel,
  roleOrder,
  type AccessLevel,
  type UserRole,
} from "@/lib/access";

export default async function PermissionsPage() {
  const supabase = await createClient();
  const access = await getAccess();

  if (!access) redirect("/login");
  if (!access.canManage("permissions")) redirect("/");

  const [{ data: permissions }, { data: profiles }] = await Promise.all([
    supabase.from("role_permissions").select("role, area, level"),
    supabase.from("profiles").select("role, active"),
  ]);

  // Start from "none" everywhere so a row missing from the table reads as no
  // access rather than as an undefined cell.
  const matrix = Object.fromEntries(
    roleOrder.map((role) => [
      role,
      Object.fromEntries(accessAreaOrder.map((area) => [area, "none" as AccessLevel])),
    ]),
  ) as Matrix;

  for (const row of permissions ?? []) {
    matrix[row.role][row.area] = row.level;
  }

  const accountsByRole = new Map<UserRole, number>();
  for (const p of profiles ?? []) {
    if (!p.active) continue;
    accountsByRole.set(p.role, (accountsByRole.get(p.role) ?? 0) + 1);
  }

  const userManagerRoles = roleOrder.filter((r) => matrix[r].users === "full");
  const managerAccounts = userManagerRoles.reduce(
    (sum, r) => sum + (accountsByRole.get(r) ?? 0),
    0,
  );
  const unusedRoles = roleOrder.filter((r) => (accountsByRole.get(r) ?? 0) === 0);

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Administration"
        title="Roles & Access"
        subtitle="What each role may do in each part of the portal. These settings are the access control itself — the database reads this same table."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Roles" value={`${roleOrder.length}`} tone="neutral" />
        <MetricTile label="Areas Governed" value={`${accessAreaOrder.length}`} tone="neutral" />
        <MetricTile
          label="Can Manage Users"
          value={`${managerAccounts}`}
          tone={managerAccounts > 1 ? "good" : "warning"}
        />
        <MetricTile
          label="Roles In Use"
          value={`${roleOrder.length - unusedRoles.length}`}
          tone="neutral"
        />
      </div>

      <PermissionsMatrix initial={matrix} editable currentRole={access.role} />

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            What each role is for
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roleOrder.map((role) => {
            const accounts = accountsByRole.get(role) ?? 0;
            return (
              <div key={role} className="flex flex-col gap-0.5 border-l-2 border-brand-mist pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{roleLabel[role]}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {accounts === 1 ? "1 account" : `${accounts} accounts`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{roleDescription[role]}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Alert>
        <KeyRound />
        <AlertTitle>Changes take effect immediately</AlertTitle>
        <AlertDescription>
          Every row-level security policy in the database consults this table, so a change here
          governs the API and the SQL editor too, not only what the portal shows. The portal will
          not let you remove user management from your own role, and the database refuses any change
          that would leave no role able to manage users at all.
        </AlertDescription>
      </Alert>
    </div>
  );
}
