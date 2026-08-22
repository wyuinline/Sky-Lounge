"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/portal/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  certificateTypeLabel,
  derivePilotCertificateStatus,
  expiryStatusLabel,
  expiryStatusTone,
  recencyDue,
} from "@/lib/compliance";
import { uploadRocA } from "@/app/(portal)/pilots/actions";

export type PilotRow = {
  id: string;
  full_name: string;
  certificate_number: string | null;
  certificate_type: "basic_operations" | "advanced_operations" | "level_1_complex" | null;
  certificate_issued: string | null;
  certificate_expires: string | null;
  last_recency_activity: string | null;
  notes: string | null;
  has_roc_a: boolean;
};

function RocACell({ pilot, canManage }: { pilot: PilotRow; canManage: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadRocA(pilot.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`ROC-A certificate recorded for ${pilot.full_name}.`);
    });
  }

  if (pilot.has_roc_a) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span className="flex size-4 items-center justify-center rounded-[4px] bg-[var(--status-good)] text-white">
          <Check className="size-3" />
        </span>
        On file
      </span>
    );
  }

  if (!canManage) {
    return <span className="text-sm text-muted-foreground">Not on file</span>;
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        {isPending ? "Uploading..." : "Upload"}
      </Button>
    </>
  );
}

export function PilotsTable({
  rows,
  canManage,
}: {
  rows: PilotRow[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (search.trim() === "") return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      [row.full_name, row.certificate_number].some((field) =>
        (field ?? "").toLowerCase().includes(q),
      ),
    );
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search by name or certificate number..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-xs"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pilot Name</TableHead>
              <TableHead>Certificate #</TableHead>
              <TableHead>Certificate Type</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Last Recency</TableHead>
              <TableHead>Recency Due</TableHead>
              <TableHead>ROC-A</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No pilots in the registry yet." : "No pilots match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const due = recencyDue(row.last_recency_activity);
                const status = derivePilotCertificateStatus(
                  row.certificate_expires,
                  row.last_recency_activity,
                );

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.certificate_number ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.certificate_type
                        ? certificateTypeLabel[row.certificate_type]
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.certificate_issued ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.certificate_expires ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {row.last_recency_activity ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{due ?? "—"}</TableCell>
                    <TableCell>
                      <RocACell pilot={row} canManage={canManage} />
                    </TableCell>
                    <TableCell>
                      {status ? (
                        <StatusDot
                          tone={expiryStatusTone[status]}
                          label={status === "current" ? "Valid" : expiryStatusLabel[status]}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          — no expiry on file —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                      {row.notes ?? ""}
                    </TableCell>
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
