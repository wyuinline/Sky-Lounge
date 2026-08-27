"use client";

import { useMemo, useState, useTransition } from "react";
import { MoreHorizontal, Pencil, CheckCheck, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AttentionFlag } from "@/components/portal/attention-flag";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import { deadlineFlag, type Flag } from "@/lib/flags";
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
import { bandStyle } from "@/components/portal/hazards/risk-matrix";
import {
  EditHazardDialog,
  hazardCategoryLabel,
  hazardStatusLabel,
  type HazardFormValues,
  type HazardStatus,
  type OwnerOption,
} from "@/components/portal/hazards/hazard-dialog";
import { riskBand, bandLabel } from "@/lib/risk";
import { markHazardReviewed, deleteHazard } from "@/app/(portal)/hazards/actions";

export type HazardRow = HazardFormValues & {
  owner_name: string | null;
  initial_score: number | null;
  residual_score: number | null;
  review_due: string | null;
  incident_count: number | null;
  open_finding_count: number | null;
};

function Band({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-muted-foreground">Not assessed</span>;
  }
  const band = riskBand(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase",
        bandStyle[band],
      )}
    >
      {bandLabel[band]}
      <span className="tabular-nums opacity-70">{score}</span>
    </span>
  );
}

function RowActions({ hazard, owners }: { hazard: HazardRow; owners: OwnerOption[] }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | null>(null);
  const [isPending, startTransition] = useTransition();
  const name = hazard.hazard_code ?? "this hazard";

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
            Edit hazard
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              run(
                () => markHazardReviewed(hazard.id),
                `${name} marked reviewed. The clock restarts today.`,
              )
            }
          >
            <CheckCheck className="size-4" />
            Mark reviewed
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
            <Trash2 className="size-4" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditHazardDialog hazard={hazard} owners={owners} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Delete ${name} permanently?`}
        description={
          <>
            This only works while no incident is linked to it. A hazard that incidents have
            evidenced is part of the safety record, and should be closed rather than removed.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        pending={isPending}
        onConfirm={() => run(() => deleteHazard(hazard.id), `${name} deleted.`)}
      />
    </>
  );
}

export function HazardsTable({
  rows,
  owners,
  canManage,
}: {
  rows: HazardRow[];
  owners: OwnerOption[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("live");
  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === "live") {
        if (row.status === "closed") return false;
      } else if (status !== "all" && row.status !== status) {
        return false;
      }
      if (q === "") return true;
      return [row.hazard_code, row.title, row.description, row.owner_name].some((f) =>
        (f ?? "").toLowerCase().includes(q),
      );
    });
  }, [rows, search, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search hazards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={status} onValueChange={(v) => setStatus(v ?? "live")}>
          <SelectTrigger className="sm:w-48">
            <SelectValue>
              {(v) =>
                v === "live"
                  ? "Live hazards"
                  : v === "all"
                    ? "All hazards"
                    : hazardStatusLabel[v as HazardStatus]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="live">Live hazards</SelectItem>
            <SelectItem value="all">All hazards</SelectItem>
            {(Object.keys(hazardStatusLabel) as HazardStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {hazardStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Ref</TableHead>
              <TableHead>Hazard</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Inherent</TableHead>
              <TableHead>Residual</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Evidence</TableHead>
              <TableHead>Review Due</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 11 : 10}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? "No hazards recorded yet. The register is the first thing an operator certificate review asks for."
                    : "No hazards match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const flags: Flag[] = [];
                if (row.status !== "closed") {
                  const reviewFlag = deadlineFlag(row.review_due, "Hazard review", now);
                  if (reviewFlag) flags.push(reviewFlag);

                  // A hazard with incidents against it is one whose controls
                  // are not working, whatever its residual score claims.
                  const evidenced = row.incident_count ?? 0;
                  if (evidenced > 0) {
                    flags.push({
                      severity: "overdue",
                      label: `${evidenced} incident${evidenced === 1 ? "" : "s"} evidenced this hazard`,
                    });
                  }
                }

                return (
                  <TableRow
                    key={row.id}
                    className={row.status === "closed" ? "opacity-60" : undefined}
                  >
                    <TableCell className="pr-0">
                      <AttentionFlag flags={flags} />
                    </TableCell>
                    <TableCell className="font-medium">{row.hazard_code}</TableCell>
                    <TableCell className="max-w-64 truncate">{row.title}</TableCell>
                    <TableCell className="text-sm">
                      {row.category ? hazardCategoryLabel[row.category] : "—"}
                    </TableCell>
                    <TableCell>
                      <Band score={row.initial_score} />
                    </TableCell>
                    <TableCell>
                      <Band score={row.residual_score} />
                    </TableCell>
                    <TableCell className="text-sm">{row.owner_name ?? "Unassigned"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {(row.incident_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[var(--status-critical)]">
                          <AlertTriangle className="size-3" />
                          {row.incident_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.review_due ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {row.status ? hazardStatusLabel[row.status] : "—"}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <RowActions hazard={row} owners={owners} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
