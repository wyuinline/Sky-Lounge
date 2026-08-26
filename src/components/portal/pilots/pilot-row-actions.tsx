"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, UserRoundCheck, UserRoundX, Trash2 } from "lucide-react";
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
import { EditPilotDialog, type PilotFormValues } from "@/components/portal/pilots/pilot-dialog";
import { deletePilot, setPilotActive } from "@/app/(portal)/pilots/actions";

type Pending = "depart" | "return" | "delete" | null;

export function PilotRowActions({
  pilot,
  active,
}: {
  pilot: PilotFormValues;
  active: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<Pending>(null);
  const [isPending, startTransition] = useTransition();

  const name = pilot.full_name;

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
          {active ? (
            <DropdownMenuItem onClick={() => setConfirming("depart")}>
              <UserRoundX className="size-4" />
              Mark as departed
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setConfirming("return")}>
              <UserRoundCheck className="size-4" />
              Return to crew
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
            <Trash2 className="size-4" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditPilotDialog pilot={pilot} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        open={confirming === "depart"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Mark ${name} as departed?`}
        description={
          <>
            They stop counting toward credential alerts and stop appearing when logging flights.
            Their record and certificate history are kept, and you can bring them back.
          </>
        }
        confirmLabel="Mark as departed"
        pending={isPending}
        onConfirm={() => run(() => setPilotActive(pilot.id, false), `${name} marked as departed.`)}
      />

      <ConfirmDialog
        open={confirming === "return"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Return ${name} to the crew?`}
        description={
          <>
            Their credentials start counting again. Check the certificate and recency dates are
            still current before they fly.
          </>
        }
        confirmLabel="Return to crew"
        pending={isPending}
        onConfirm={() => run(() => setPilotActive(pilot.id, true), `${name} returned to the crew.`)}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Delete ${name} permanently?`}
        description={
          <>
            This cannot be undone. It only works while nothing references them — anyone with
            flights, incidents, or training on record is refused by the database, and should be
            marked as departed instead.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        pending={isPending}
        onConfirm={() => run(() => deletePilot(pilot.id), `${name} deleted.`)}
      />
    </>
  );
}
