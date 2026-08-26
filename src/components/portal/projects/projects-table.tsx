"use client";

import { useMemo, useState, useTransition } from "react";
import { MoreHorizontal, Pencil, CheckCircle2, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/portal/status-dot";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EditProjectDialog,
  projectStatusLabel,
  type ClientOption,
  type ProjectFormValues,
  type ProjectStatus,
} from "@/components/portal/projects/project-dialog";
import { deleteProject, setProjectStatus } from "@/app/(portal)/projects/actions";

export type ProjectRow = ProjectFormValues & {
  client_name: string | null;
  flight_count: number | null;
  flight_hours: number | null;
  first_flight: string | null;
  last_flight: string | null;
  pilots_used: number | null;
  aircraft_used: number | null;
  estimated_cost: number | null;
};

const statusTone: Record<ProjectStatus, "good" | "neutral" | "warning" | "muted"> = {
  planned: "neutral",
  active: "good",
  on_hold: "warning",
  complete: "muted",
  cancelled: "muted",
};

function round1(n: number | null): string {
  if (n === null) return "0";
  return String(Math.round(n * 10) / 10);
}

/** Money, only where a rate has actually been set. */
function money(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

function RowActions({
  project,
  clients,
}: {
  project: ProjectRow;
  clients: ClientOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"complete" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();
  const name = project.project_code ?? "this project";

  function run(work: () => Promise<{ error: string | null }>, success: string) {
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setConfirming(null);
      toast.success(success);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button size="icon" variant="ghost" aria-label={`Actions for ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit details
          </DropdownMenuItem>
          {project.status !== "complete" ? (
            <DropdownMenuItem onClick={() => setConfirming("complete")}>
              <CheckCircle2 className="size-4" />
              Mark complete
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
            <Trash2 className="size-4" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProjectDialog
        project={project}
        clients={clients}
        open={editing}
        onOpenChange={setEditing}
      />

      <ConfirmDialog
        open={confirming === "complete"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Mark ${name} complete?`}
        description={
          <>
            It stops being offered when logging new flights. Its hours and history are kept, and
            you can reopen it by editing the status.
          </>
        }
        confirmLabel="Mark complete"
        pending={isPending}
        onConfirm={() => run(() => setProjectStatus(project.id, "complete"), `${name} completed.`)}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Delete ${name} permanently?`}
        description={
          <>
            This cannot be undone, and only works while no flight is recorded against the project.
            Anything that has flown must be marked complete or cancelled instead — deleting it
            would detach those hours from the job.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        pending={isPending}
        onConfirm={() => run(() => deleteProject(project.id), `${name} deleted.`)}
      />
    </>
  );
}

export function ProjectsTable({
  rows,
  clients,
  canManage,
}: {
  rows: ProjectRow[];
  clients: ClientOption[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("open");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === "open") {
        if (row.status === "complete" || row.status === "cancelled") return false;
      } else if (status !== "all" && row.status !== status) {
        return false;
      }
      if (q === "") return true;
      return [row.project_code, row.name, row.client_name, row.site_name].some((f) =>
        (f ?? "").toLowerCase().includes(q),
      );
    });
  }, [rows, search, status]);

  const anyRate = rows.some((r) => r.hourly_rate !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by job number, name, client, or site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={status} onValueChange={(v) => setStatus(v ?? "open")}>
          <SelectTrigger className="sm:w-52">
            <SelectValue>
              {(v) =>
                v === "open"
                  ? "Open projects"
                  : v === "all"
                    ? "All projects"
                    : projectStatusLabel[v as ProjectStatus]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open projects</SelectItem>
            <SelectItem value="all">All projects</SelectItem>
            {(Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {projectStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Number</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Flights</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              {anyRate ? <TableHead className="text-right">Est. Cost</TableHead> : null}
              <TableHead>Last Flight</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={(canManage ? 9 : 8) + (anyRate ? 1 : 0)}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? "No projects yet. Create one so flights can be attributed to the job they served."
                    : "No projects match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    row.status === "complete" || row.status === "cancelled"
                      ? "opacity-60"
                      : undefined
                  }
                >
                  <TableCell className="font-medium">{row.project_code}</TableCell>
                  <TableCell className="max-w-56 truncate">{row.name}</TableCell>
                  <TableCell>{row.client_name ?? "Internal"}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      {row.latitude !== null ? (
                        <MapPin className="size-3 shrink-0 text-muted-foreground" />
                      ) : null}
                      {row.site_name ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.flight_count ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {round1(row.flight_hours)}
                  </TableCell>
                  {anyRate ? (
                    <TableCell className="text-right tabular-nums">
                      {money(row.estimated_cost)}
                    </TableCell>
                  ) : null}
                  <TableCell className="tabular-nums">{row.last_flight ?? "—"}</TableCell>
                  <TableCell>
                    {row.status ? (
                      <StatusDot
                        tone={statusTone[row.status]}
                        label={projectStatusLabel[row.status]}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <RowActions project={row} clients={clients} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
