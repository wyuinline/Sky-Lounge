import { CalendarClock } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { SectionLabel } from "@/components/portal/section-label";
import { AuditsTable, type AuditRow } from "@/components/portal/audits/audits-table";
import { FindingsTable, type FindingRow } from "@/components/portal/audits/findings-table";
import { ScheduleAuditDialog } from "@/components/portal/audits/schedule-audit-dialog";
import { AddFindingDialog } from "@/components/portal/audits/add-finding-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

export default async function AuditsPage() {
  const supabase = await createClient();
  const [profile, auditsRes, findingsRes, profilesRes] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("audits")
      .select("id, audit_type, audit_date, status, compliance_status, auditor:auditor_id(full_name)")
      .order("audit_date", { ascending: false })
      .returns<AuditRow[]>(),
    supabase
      .from("audit_findings")
      .select("id, severity, description, due_date, status, assignee:assigned_to(full_name)")
      .neq("status", "closed")
      .order("due_date")
      .returns<FindingRow[]>(),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const audits = auditsRes.data ?? [];
  const findings = findingsRes.data ?? [];
  const profileOptions = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? "Unnamed",
  }));
  const auditOptions = audits.map((a) => ({
    id: a.id,
    label: `${a.audit_type === "internal" ? "Internal" : "Regulatory"} — ${a.audit_date}`,
  }));

  const canManage = profile ? ["uav_admin", "ops_manager", "auditor"].includes(profile.role) : false;

  const scored = audits.filter((a) => a.compliance_status !== null);
  const complianceScore =
    scored.length > 0
      ? Math.round((scored.filter((a) => a.compliance_status === "compliant").length / scored.length) * 100)
      : null;
  const overdueActions = findings.filter((f) => f.status === "overdue").length;
  const currentYear = new Date().getFullYear();
  const auditsCompletedYtd = audits.filter(
    (a) => a.status === "completed" && new Date(a.audit_date).getFullYear() === currentYear,
  ).length;
  const today = new Date().toISOString().slice(0, 10);
  const nextAudit = audits
    .filter((a) => a.status === "planned" && a.audit_date >= today)
    .sort((a, b) => a.audit_date.localeCompare(b.audit_date))[0];

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Compliance Records"
        title="Audits & Compliance"
        subtitle="Internal and regulatory audit tracking, findings management, corrective actions, and compliance dashboards."
        actions={
          canManage ? (
            <>
              <AddFindingDialog audits={auditOptions} assignees={profileOptions} />
              <ScheduleAuditDialog auditors={profileOptions} />
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Compliance Score"
          value={complianceScore !== null ? `${complianceScore}%` : "—"}
          tone="neutral"
        />
        <MetricTile label="Open Findings" value={`${findings.length}`} tone="neutral" />
        <MetricTile
          label="Overdue Actions"
          value={`${overdueActions}`}
          tone={overdueActions > 0 ? "critical" : "good"}
        />
        <MetricTile label="Audits Completed (YTD)" value={`${auditsCompletedYtd}`} tone="good" />
      </div>

      {nextAudit && (
        <div className="flex items-center gap-2 rounded-md border px-4 py-3 text-sm text-muted-foreground">
          <CalendarClock className="size-4" />
          Next scheduled audit: <span className="font-medium text-foreground">{nextAudit.audit_date}</span>
        </div>
      )}

      <div>
        <SectionLabel>Audit Schedule</SectionLabel>
        <AuditsTable rows={audits} />
      </div>

      <div>
        <SectionLabel>Open Findings</SectionLabel>
        <FindingsTable rows={findings} />
      </div>
    </div>
  );
}
