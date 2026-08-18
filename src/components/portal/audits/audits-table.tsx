import { StatusDot } from "@/components/portal/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AuditRow = {
  id: string;
  audit_type: "internal" | "regulatory";
  audit_date: string;
  status: "planned" | "in_progress" | "completed" | "overdue";
  compliance_status: "compliant" | "at_risk" | "non_compliant" | null;
  auditor: { full_name: string | null } | null;
};

const statusTone: Record<AuditRow["status"], "neutral" | "good" | "critical"> = {
  planned: "neutral",
  in_progress: "neutral",
  completed: "good",
  overdue: "critical",
};

const complianceTone: Record<NonNullable<AuditRow["compliance_status"]>, "good" | "warning" | "critical"> = {
  compliant: "good",
  at_risk: "warning",
  non_compliant: "critical",
};

export function AuditsTable({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Audit Type</TableHead>
            <TableHead>Audit Date</TableHead>
            <TableHead>Auditor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Compliance Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No audits scheduled yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium capitalize">{row.audit_type}</TableCell>
                <TableCell>{row.audit_date}</TableCell>
                <TableCell>{row.auditor?.full_name ?? "—"}</TableCell>
                <TableCell>
                  <StatusDot tone={statusTone[row.status]} label={row.status.replace("_", " ")} />
                </TableCell>
                <TableCell>
                  {row.compliance_status ? (
                    <StatusDot
                      tone={complianceTone[row.compliance_status]}
                      label={row.compliance_status.replace("_", " ")}
                    />
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
