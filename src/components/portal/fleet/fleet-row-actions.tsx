"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, PlaneTakeoff, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import { EditUavDialog, type UavFormValues } from "@/components/portal/fleet/uav-dialog";
import { deleteUav, setUavRetired } from "@/app/(portal)/fleet/actions";

type Pending = "retire" | "restore" | "delete" | null;

export function FleetRowActions({ uav }: { uav: UavFormValues }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [isPending, startTransition] = useTransition();

  const retired = uav.status === "retired";
  const name = uav.drone_id ?? "this airframe";

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
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit details
          </DropdownMenuItem>
          {retired ? (
            <DropdownMenuItem onClick={() => setConfirming("restore")}>
              <PlaneTakeoff className="size-4" />
              Return to fleet
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setConfirming("retire")}>
              <Archive className="size-4" />
              Retire airframe
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
            <Trash2 className="size-4" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUavDialog uav={uav} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        open={confirming === "retire"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Retire ${name}?`}
        description={
          <>
            It leaves the fleet totals and stops appearing when logging flights or booking
            servicing. Everything already recorded against it is kept, and you can bring it back.
          </>
        }
        confirmLabel="Retire airframe"
        pending={isPending}
        onConfirm={() => run(() => setUavRetired(uav.id, true), `${name} retired.`)}
      />

      <ConfirmDialog
        open={confirming === "restore"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Return ${name} to the fleet?`}
        description={
          <>
            It comes back as <strong>grounded</strong> rather than airworthy — someone has to
            confirm its condition before it flies again.
          </>
        }
        confirmLabel="Return to fleet"
        pending={isPending}
        onConfirm={() => run(() => setUavRetired(uav.id, false), `${name} returned as grounded.`)}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Delete ${name} permanently?`}
        description={
          <>
            This cannot be undone. It only works while nothing references the airframe — if it has
            flights, servicing, or incidents recorded, the database will refuse and you should
            retire it instead.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        pending={isPending}
        onConfirm={() => run(() => deleteUav(uav.id), `${name} deleted.`)}
      />
    </>
  );
}
