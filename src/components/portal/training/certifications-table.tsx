import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CertificationRow = {
  id: string;
  pilot_id: string;
  certification_name: string;
  issue_date: string | null;
  expiry_date: string | null;
  competency_level: "beginner" | "intermediate" | "advanced" | "qualified" | null;
  status: "current" | "due_soon" | "expired";
  pilots: { full_name: string } | null;
};

const statusVariant: Record<CertificationRow["status"], "default" | "secondary" | "destructive"> = {
  current: "default",
  due_soon: "secondary",
  expired: "destructive",
};

export function CertificationsTable({ rows }: { rows: CertificationRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pilot Name</TableHead>
            <TableHead>Certification</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Competency Level</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No certifications on file yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.pilots?.full_name ?? "—"}</TableCell>
                <TableCell>{row.certification_name}</TableCell>
                <TableCell>{row.issue_date ?? "—"}</TableCell>
                <TableCell>{row.expiry_date ?? "—"}</TableCell>
                <TableCell className="capitalize">{row.competency_level ?? "—"}</TableCell>
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
