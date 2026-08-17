import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { SectionLabel } from "@/components/portal/section-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CertificationsTable,
  type CertificationRow,
} from "@/components/portal/training/certifications-table";
import { UploadCertificationDialog } from "@/components/portal/training/upload-certification-dialog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

const competencyRank = { beginner: 0, intermediate: 1, advanced: 2, qualified: 3 } as const;

export default async function TrainingPage() {
  const supabase = await createClient();
  const [profile, recordsRes, pilotsRes] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("training_records")
      .select(
        "id, pilot_id, certification_name, issue_date, expiry_date, competency_level, status, pilots(full_name)",
      )
      .order("expiry_date")
      .returns<CertificationRow[]>(),
    supabase.from("pilots").select("id, full_name").order("full_name"),
  ]);

  const records = recordsRes.data ?? [];
  const pilotOptions = (pilotsRes.data ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const canManage = profile ? ["uav_admin", "ops_manager"].includes(profile.role) : false;

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const expiringSoon = records.filter(
    (r) => r.expiry_date && new Date(r.expiry_date) >= now && new Date(r.expiry_date) <= in60Days,
  ).length;
  const expired = records.filter((r) => r.status === "expired").length;

  const highestByPilot = new Map<string, number>();
  for (const r of records) {
    if (!r.competency_level) continue;
    const rank = competencyRank[r.competency_level];
    const current = highestByPilot.get(r.pilot_id) ?? -1;
    if (rank > current) highestByPilot.set(r.pilot_id, rank);
  }
  const qualifiedCount = [...highestByPilot.values()].filter((r) => r === 3).length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Crew Readiness"
        title="Training & Certification Portal"
        subtitle="Course tracking, certification management, competency levels, and renewal reminders — keeping our team mission-ready."
        actions={canManage ? <UploadCertificationDialog pilots={pilotOptions} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Certifications on File" value={`${records.length}`} tone="neutral" />
        <MetricTile
          label="Expiring (60 days)"
          value={`${expiringSoon}`}
          tone={expiringSoon > 0 ? "warning" : "good"}
        />
        <MetricTile label="Expired" value={`${expired}`} tone={expired > 0 ? "critical" : "good"} />
        <MetricTile label="Fully Qualified Pilots" value={`${qualifiedCount}`} tone="good" />
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="font-heading text-sm font-bold tracking-wide uppercase">
            Competency Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Tracks each pilot&apos;s highest demonstrated competency level from the certifications below.
          Reviewed during audits — see the Certification Status table for the full breakdown per pilot.
        </CardContent>
      </Card>

      <div>
        <SectionLabel>Certification Status</SectionLabel>
        <CertificationsTable rows={records} />
      </div>
    </div>
  );
}
