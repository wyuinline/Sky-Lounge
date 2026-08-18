import { StatusDot } from "@/components/portal/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FindingRow = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  due_date: string | null;
  status: "open" | "in_progress" | "closed" | "overdue";
  assignee: { full_name: string | null } | null;
};

const severityTone: Record<FindingRow["severity"], "good" | "neutral" | "warning" | "critical"> = {
  low: "good",
  medium: "neutral",
  high: "warning",
  critical: "critical",
};

const statusTone: Record<FindingRow["status"], "neutral" | "good" | "critical"> = {
  open: "neutral",
  in_progress: "neutral",
  closed: "good",
  overdue: "critical",
};

export function FindingsTable({ rows }: { rows: FindingRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Severity</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No open findings.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <StatusDot tone={severityTone[row.severity]} label={row.severity} />
                </TableCell>
                <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                <TableCell>{row.assignee?.full_name ?? "—"}</TableCell>
                <TableCell>{row.due_date ?? "—"}</TableCell>
                <TableCell>
                  <StatusDot tone={statusTone[row.status]} label={row.status.replace("_", " ")} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
