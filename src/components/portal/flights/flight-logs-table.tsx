import { StatusDot } from "@/components/portal/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FlightLogRow = {
  id: string;
  flight_date: string;
  duration_minutes: number | null;
  weather_conditions: string | null;
  mission_outcome: "completed" | "aborted" | "partial";
  pilots: { full_name: string } | null;
  uavs: { drone_id: string } | null;
};

const outcomeTone: Record<FlightLogRow["mission_outcome"], "good" | "warning" | "critical"> = {
  completed: "good",
  partial: "warning",
  aborted: "critical",
};

export function FlightLogsTable({ rows }: { rows: FlightLogRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Flight Date</TableHead>
            <TableHead>Pilot</TableHead>
            <TableHead>UAV</TableHead>
            <TableHead>Duration (min)</TableHead>
            <TableHead>Weather</TableHead>
            <TableHead>Outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No flight logs yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.flight_date}</TableCell>
                <TableCell>{row.pilots?.full_name ?? "—"}</TableCell>
                <TableCell>{row.uavs?.drone_id ?? "—"}</TableCell>
                <TableCell>{row.duration_minutes ?? "—"}</TableCell>
                <TableCell>{row.weather_conditions ?? "—"}</TableCell>
                <TableCell>
                  <StatusDot tone={outcomeTone[row.mission_outcome]} label={row.mission_outcome} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
