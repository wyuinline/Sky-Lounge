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
import { getAccess } from "@/lib/permissions";
import { deriveExpiryStatus } from "@/lib/compliance";

const competencyRank = { beginner: 0, intermediate: 1, advanced: 2, qualified: 3 } as const;

export default async function TrainingPage() {
  const supabase = await createClient();
  const [access, recordsRes, pilotsRes] = await Promise.all([
    getAccess(),
    supabase
      .from("training_records")
      .select(
        "id, pilot_id, certification_name, issue_date, expiry_date, competency_level, status, pilots(full_name)",
      )
      .order("expiry_date")
,
    supabase.from("pilots").select("id, full_name").order("full_name"),
  ]);

  const records = recordsRes.data ?? [];
  const pilotOptions = (pilotsRes.data ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const canManage = access?.canManage("training") ?? false;

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const expiringSoon = records.filter(
    (r) => r.expiry_date && new Date(r.expiry_date) >= now && new Date(r.expiry_date) <= in60Days,
  ).length;
  // Derived from expiry_date — the stored status never advances past its
  // insert-time default, so this previously always reported zero.
  const expired = records.filter(
    (r) => deriveExpiryStatus(r.expiry_date, now) === "expired",
  ).length;

  const highestByPilot = new Map<string, number>();
  for (const r of records) {
    // pilot_id is nullable, so an orphaned certification can't be attributed
    // to anyone and must not be counted toward a pilot's competency.
    if (!r.competency_level || !r.pilot_id) continue;
    const rank = competencyRank[r.competency_level];
    const current = highestByPilot.get(r.pilot_id) ?? -1;
    if (rank > current) highestByPilot.set(r.pilot_id, rank);
  }
  const qualifiedCount = [...highestByPilot.values()].filter((r) => r === 3).length;

  // RLS limits pilots to their own training records, so for them these figures
  // describe one person, not the programme. Label them accordingly rather than
  // presenting a personal count as an organisation-wide total.
  const seesAllRecords = access?.canReadAll("training") ?? false;
  const scope = seesAllRecords ? "" : "Your ";

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Crew Readiness"
        title="Training & Certification Portal"
        subtitle="Course tracking, certification management, competency levels, and renewal reminders — keeping our team mission-ready."
        actions={canManage ? <UploadCertificationDialog pilots={pilotOptions} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label={`${scope}Certifications on File`}
          value={`${records.length}`}
          tone="neutral"
        />
        <MetricTile
          label={`${scope}Expiring (60 days)`}
          value={`${expiringSoon}`}
          tone={expiringSoon > 0 ? "warning" : "good"}
        />
        <MetricTile
          label={`${scope}Expired`}
          value={`${expired}`}
          tone={expired > 0 ? "critical" : "good"}
        />
        {seesAllRecords ? (
          <MetricTile label="Fully Qualified Pilots" value={`${qualifiedCount}`} tone="good" />
        ) : (
          <MetricTile
            label="Your Competency Level"
            value={qualifiedCount > 0 ? "Qualified" : "In Progress"}
            tone={qualifiedCount > 0 ? "good" : "neutral"}
          />
        )}
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
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
