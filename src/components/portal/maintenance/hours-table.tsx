import { StatusDot } from "@/components/portal/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { crossedHoursThreshold } from "@/lib/reminders";

export type AirframeHoursRow = {
  uav_id: string | null;
  drone_id: string | null;
  maintenance_interval_hours: number | null;
  hours_since_service: number | null;
  hours_until_service: number | null;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Hours remaining against each airframe's service interval — the same figures
 * the weekly reminder scan reads, so what the portal shows and what triggers a
 * reminder cannot drift apart.
 */
export function AirframeHoursTable({ rows }: { rows: AirframeHoursRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>UAV</TableHead>
            <TableHead className="text-right">Interval</TableHead>
            <TableHead className="text-right">Hours Since Service</TableHead>
            <TableHead className="text-right">Hours Remaining</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No airframes have an hours-based service interval set yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const remaining = row.hours_until_service;
              const overdue = remaining !== null && remaining <= 0;
              const approaching =
                remaining !== null && !overdue && crossedHoursThreshold(remaining) !== null;

              return (
                <TableRow key={row.uav_id ?? row.drone_id}>
                  <TableCell className="font-medium">{row.drone_id ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.maintenance_interval_hours !== null
                      ? `${row.maintenance_interval_hours} h`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.hours_since_service !== null ? round1(row.hours_since_service) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {remaining !== null ? round1(remaining) : "—"}
                  </TableCell>
                  <TableCell>
                    {overdue ? (
                      <StatusDot tone="critical" label="Interval passed" />
                    ) : approaching ? (
                      <StatusDot tone="warning" label="Service soon" />
                    ) : (
                      <StatusDot tone="good" label="In interval" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
