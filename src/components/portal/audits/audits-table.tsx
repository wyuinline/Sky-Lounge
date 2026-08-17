import { Badge } from "@/components/ui/badge";
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
  auditor: { full_name: string } | null;
};

const statusVariant: Record<AuditRow["status"], "default" | "secondary" | "destructive"> = {
  planned: "secondary",
  in_progress: "default",
  completed: "default",
  overdue: "destructive",
};

const complianceVariant: Record<NonNullable<AuditRow["compliance_status"]>, "default" | "secondary" | "destructive"> = {
  compliant: "default",
  at_risk: "secondary",
  non_compliant: "destructive",
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
                  <Badge variant={statusVariant[row.status]} className="capitalize">
                    {row.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.compliance_status ? (
                    <Badge variant={complianceVariant[row.compliance_status]} className="capitalize">
                      {row.compliance_status.replace("_", " ")}
                    </Badge>
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
