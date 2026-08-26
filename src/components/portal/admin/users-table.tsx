"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabels, type UserRole } from "@/lib/types";
import {
  linkPilotToProfile,
  sendPasswordReset,
  setUserActive,
  updateUserRole,
} from "@/app/(portal)/admin/users/actions";

export type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  linked_pilot_id: string | null;
};

export type PilotOption = { id: string; full_name: string };

const UNLINKED = "__none__";

export function UsersTable({
  rows,
  pilots,
  currentUserId,
}: {
  rows: UserRow[];
  pilots: PilotOption[];
  currentUserId: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(id: string, work: () => Promise<{ error: string | null }>, success: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await work();
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Linked Pilot</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Access</TableHead>
            <TableHead className="text-right">Password</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                No accounts yet. Use Invite User to send someone a sign-in link.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const busy = isPending && pendingId === row.id;
              const isSelf = row.id === currentUserId;

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.full_name || "—"}
                    {isSelf ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.email ?? "—"}</TableCell>

                  <TableCell>
                    {/* Nobody edits their own role — the database refuses it too. */}
                    <Select
                      value={row.role}
                      disabled={busy || isSelf}
                      onValueChange={(v) =>
                        v &&
                        v !== row.role &&
                        run(
                          row.id,
                          () => updateUserRole(row.id, v),
                          `${row.full_name || row.email} is now ${roleLabels[v as UserRole]}.`,
                        )
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(roleLabels) as UserRole[]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {roleLabels[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <Select
                      value={row.linked_pilot_id ?? UNLINKED}
                      disabled={busy}
                      onValueChange={(v) => {
                        if (!v) return;
                        const pilotId = v === UNLINKED ? null : v;
                        if (pilotId === row.linked_pilot_id) return;
                        run(
                          row.id,
                          () => linkPilotToProfile(row.id, pilotId),
                          pilotId ? "Pilot record linked." : "Pilot record unlinked.",
                        );
                      }}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Not linked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNLINKED}>Not linked</SelectItem>
                        {pilots.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <Badge variant={row.active ? "default" : "secondary"}>
                      {row.active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          row.id,
                          () => setUserActive(row.id, !row.active),
                          row.active ? "Access removed." : "Access restored.",
                        )
                      }
                    >
                      {row.active ? "Disable" : "Enable"}
                    </Button>
                  </TableCell>

                  <TableCell className="text-right">
                    {/*
                      Sends a link rather than setting a password. An
                      administrator who can read a colleague's password can also
                      sign in as them, and the audit trail stops meaning much.
                    */}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || !row.active || !row.email}
                      onClick={() =>
                        run(
                          row.id,
                          () => sendPasswordReset(row.id),
                          `Reset link sent to ${row.email}.`,
                        )
                      }
                    >
                      Send reset link
                    </Button>
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
