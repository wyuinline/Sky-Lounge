import { Briefcase } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { SectionLabel } from "@/components/portal/section-label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ProjectsTable,
  type ProjectRow,
} from "@/components/portal/projects/projects-table";
import {
  AddProjectDialog,
  type ClientOption,
  type ProjectStatus,
} from "@/components/portal/projects/project-dialog";
import { AddClientDialog } from "@/components/portal/projects/client-dialog";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [access, projectsRes, clientsRes] = await Promise.all([
    getAccess(),
    // The view carries derived flight count, hours and estimated cost, so this
    // page and any report read the same figures.
    supabase
      .from("project_summary")
      .select(
        "id, project_code, name, client_id, client_name, site_name, latitude, longitude, status, start_date, end_date, hourly_rate, notes, flight_count, flight_hours, first_flight, last_flight, pilots_used, aircraft_used, estimated_cost",
      )
      .order("project_code", { ascending: false }),
    supabase.from("clients").select("id, name, active").eq("active", true).order("name"),
  ]);

  const canManage = access?.canManage("requests") ?? false;

  const rows: ProjectRow[] = (projectsRes.data ?? []).map((p) => ({
    id: p.id ?? "",
    project_code: p.project_code,
    name: p.name,
    client_id: p.client_id,
    client_name: p.client_name,
    site_name: p.site_name,
    latitude: p.latitude,
    longitude: p.longitude,
    status: p.status as ProjectStatus | null,
    start_date: p.start_date,
    end_date: p.end_date,
    hourly_rate: p.hourly_rate,
    notes: p.notes,
    flight_count: p.flight_count,
    flight_hours: p.flight_hours,
    first_flight: p.first_flight,
    last_flight: p.last_flight,
    pilots_used: p.pilots_used,
    aircraft_used: p.aircraft_used,
    estimated_cost: p.estimated_cost,
  }));

  const clients: ClientOption[] = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const open = rows.filter((r) => r.status !== "complete" && r.status !== "cancelled");
  const active = rows.filter((r) => r.status === "active").length;
  const totalHours = rows.reduce((sum, r) => sum + (r.flight_hours ?? 0), 0);
  // Only counted where a rate is actually set — the rest report hours alone.
  const totalValue = rows.reduce((sum, r) => sum + (r.estimated_cost ?? 0), 0);
  const unattributed = rows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Commercial"
        title="Projects & Clients"
        subtitle="What the flying was for. Hours attributed to the job they served, so utilisation and cost per site can be answered."
        actions={
          canManage ? (
            <>
              <AddClientDialog />
              <AddProjectDialog clients={clients} />
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Open Projects" value={`${open.length}`} tone="neutral" />
        <MetricTile label="Active" value={`${active}`} tone={active > 0 ? "good" : "neutral"} />
        <MetricTile
          label="Hours Attributed"
          value={`${Math.round(totalHours * 10) / 10}`}
          tone="neutral"
        />
        <MetricTile
          label="Estimated Value"
          value={
            totalValue > 0
              ? totalValue.toLocaleString("en-CA", {
                  style: "currency",
                  currency: "CAD",
                  maximumFractionDigits: 0,
                })
              : "—"
          }
          tone="neutral"
        />
      </div>

      <div>
        <SectionLabel>Projects</SectionLabel>
        <ProjectsTable rows={rows} clients={clients} canManage={canManage} />
      </div>

      <Alert>
        <Briefcase />
        <AlertTitle>How hours reach a project</AlertTitle>
        <AlertDescription>
          {unattributed
            ? "Create a project, then choose it when logging a flight. Hours accumulate against the job automatically — there is nothing separate to maintain."
            : "Hours come from the flights logged against each project, using the same derived duration as everywhere else. Recording real takeoff and landing times improves a job's figures with no extra step. Estimated value appears only for projects with a flying rate set; the rest report hours alone rather than inventing a number."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
