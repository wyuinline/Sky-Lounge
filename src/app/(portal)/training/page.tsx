import { GraduationCap, Clock, AlertTriangle, Award } from "lucide-react";
import { PageHero } from "@/components/portal/page-hero";
import { StatCard } from "@/components/portal/stat-card";
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
      <PageHero
        title="Training & Certification Portal"
        subtitle="Course tracking, certification management, competency levels, and renewal reminders — keeping our team mission-ready."
        actions={canManage ? <UploadCertificationDialog pilots={pilotOptions} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Certifications on File" value={`${records.length}`} icon={GraduationCap} />
        <StatCard
          label="Expiring (60 days)"
          value={`${expiringSoon}`}
          icon={Clock}
          tone={expiringSoon > 0 ? "warning" : "default"}
        />
        <StatCard label="Expired" value={`${expired}`} icon={AlertTriangle} tone={expired > 0 ? "critical" : "default"} />
        <StatCard label="Fully Qualified Pilots" value={`${qualifiedCount}`} icon={Award} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competency Matrix</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Tracks each pilot&apos;s highest demonstrated competency level from the certifications below.
          Reviewed during audits — see the Certification Status table for the full breakdown per pilot.
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Certification Status</h2>
        <CertificationsTable rows={records} />
      </div>
    </div>
  );
}
