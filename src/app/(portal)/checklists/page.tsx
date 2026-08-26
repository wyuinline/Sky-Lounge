import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { SectionLabel } from "@/components/portal/section-label";
import { StatusDot } from "@/components/portal/status-dot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChecklistBuilder } from "@/components/portal/checklists/checklist-builder";
import {
  RunChecklistDialog,
  type RunnableChecklist,
} from "@/components/portal/checklists/run-checklist-dialog";
import { ChecklistRowActions } from "@/components/portal/checklists/checklist-row-actions";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";

export default async function ChecklistsPage() {
  const supabase = await createClient();
  const [access, templatesRes, completionsRes, uavsRes] = await Promise.all([
    getAccess(),
    supabase
      .from("checklist_templates")
      .select("id, name, description, applies_to_model, active, checklist_items(id, prompt, critical, sort_order)")
      .order("name"),
    supabase
      .from("checklist_completion_summary")
      .select(
        "id, template_name, drone_id, completed_by_name, completed_at, all_critical_passed, item_count, checked_count, notes",
      )
      .order("completed_at", { ascending: false })
      .limit(30),
    supabase.from("uavs").select("id, drone_id").neq("status", "retired").order("drone_id"),
  ]);

  const canManage = access?.canManage("fleet") ?? false;
  const canRun = access?.canCreate("requests") ?? false;

  const templates = (templatesRes.data ?? []).map((t) => ({
    ...t,
    items: [...(t.checklist_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  const runnable: RunnableChecklist[] = templates
    .filter((t) => t.active && t.items.length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      applies_to_model: t.applies_to_model,
      items: t.items.map((i) => ({ id: i.id, prompt: i.prompt, critical: i.critical })),
    }));

  const uavOptions = (uavsRes.data ?? []).map((u) => ({ id: u.id, label: u.drone_id }));
  const completions = completionsRes.data ?? [];
  const failed = completions.filter((c) => c.all_critical_passed === false).length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Operational Control"
        title="Checklists"
        subtitle="A completed checklist is evidence. These are the lists the crew works through, and the record of every time they did."
        actions={
          <>
            {canRun ? <RunChecklistDialog checklists={runnable} uavs={uavOptions} /> : null}
            {canManage ? <ChecklistBuilder /> : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Active Checklists" value={`${runnable.length}`} tone="neutral" />
        <MetricTile
          label="Completions (last 30)"
          value={`${completions.length}`}
          tone="neutral"
        />
        <MetricTile
          label="With No-Go Outstanding"
          value={`${failed}`}
          tone={failed > 0 ? "critical" : "good"}
        />
        <MetricTile label="Retired Lists" value={`${templates.filter((t) => !t.active).length}`} tone="neutral" />
      </div>

      <div>
        <SectionLabel>Checklists</SectionLabel>
        {templates.length === 0 ? (
          <Card className="rounded-md">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardCheck className="size-6 text-brand-teal" />
              <p className="text-sm font-medium">No checklists yet</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Create one and the crew can work through it before each flight. A starting list is
                pre-filled for you — adjust it to how the work is actually done.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {templates.map((t) => (
              <Card key={t.id} className={`rounded-md py-0 ${t.active ? "" : "opacity-60"}`}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-base font-semibold tracking-[-0.01em]">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t.applies_to_model ? `${t.applies_to_model} · ` : "Any aircraft · "}
                        {t.items.length} item{t.items.length === 1 ? "" : "s"} ·{" "}
                        {t.items.filter((i) => i.critical).length} no-go
                      </p>
                    </div>
                    {canManage ? (
                      <ChecklistRowActions id={t.id} name={t.name} active={t.active} />
                    ) : null}
                  </div>
                  {t.description ? (
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  ) : null}
                  <ul className="flex flex-col gap-0.5 pt-1">
                    {t.items.slice(0, 4).map((i) => (
                      <li key={i.id} className="flex items-baseline gap-2 text-xs">
                        <span className="text-muted-foreground">·</span>
                        <span className="flex-1">{i.prompt}</span>
                        {i.critical ? (
                          <span className="shrink-0 text-[0.6rem] font-semibold text-[var(--status-critical)]">
                            NO-GO
                          </span>
                        ) : null}
                      </li>
                    ))}
                    {t.items.length > 4 ? (
                      <li className="pl-4 text-xs text-muted-foreground">
                        and {t.items.length - 4} more
                      </li>
                    ) : null}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Recent Completions</SectionLabel>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Completed</TableHead>
                <TableHead>Checklist</TableHead>
                <TableHead>Aircraft</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>No-Go Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No checklists have been completed yet.
                  </TableCell>
                </TableRow>
              ) : (
                completions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="tabular-nums">
                      {c.completed_at?.slice(0, 16).replace("T", " ") ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">{c.template_name}</TableCell>
                    <TableCell>{c.drone_id ?? "—"}</TableCell>
                    <TableCell>{c.completed_by_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.checked_count}/{c.item_count}
                    </TableCell>
                    <TableCell>
                      <StatusDot
                        tone={c.all_critical_passed ? "good" : "critical"}
                        label={c.all_critical_passed ? "All passed" : "Outstanding"}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Why a checklist cannot be edited once used</AlertTitle>
        <AlertDescription>
          Changing the list after a crew has signed it would silently alter what they appear to have
          checked. A used checklist is fixed by the database; deactivate it and create a new version
          when the procedure changes, and every past completion keeps showing what was actually
          asked at the time.
        </AlertDescription>
      </Alert>
    </div>
  );
}
