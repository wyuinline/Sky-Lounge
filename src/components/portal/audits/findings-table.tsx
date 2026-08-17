import { Badge } from "@/components/ui/badge";
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
  assignee: { full_name: string } | null;
};

const severityVariant: Record<FindingRow["severity"], "default" | "secondary" | "destructive"> = {
  low: "secondary",
  medium: "default",
  high: "destructive",
  critical: "destructive",
};

const statusVariant: Record<FindingRow["status"], "default" | "secondary" | "destructive"> = {
  open: "secondary",
  in_progress: "default",
  closed: "default",
  overdue: "destructive",
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
                  <Badge variant={severityVariant[row.severity]} className="capitalize">
                    {row.severity}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                <TableCell>{row.assignee?.full_name ?? "—"}</TableCell>
                <TableCell>{row.due_date ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[row.status]} className="capitalize">
                    {row.status.replace("_", " ")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
