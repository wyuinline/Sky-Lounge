"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, EyeOff, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setChecklistActive, deleteChecklist } from "@/app/(portal)/checklists/actions";

export function ChecklistRowActions({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: boolean;
}) {
  const [confirming, setConfirming] = useState<"delete" | null>(null);
  const [isPending, startTransition] = useTransition();

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
          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() =>
              run(
                () => setChecklistActive(id, !active),
                active ? `${name} retired.` : `${name} back in use.`,
              )
            }
          >
            {active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {active ? "Retire this list" : "Put back in use"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
            <Trash2 className="size-4" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={`Delete ${name} permanently?`}
        description={
          <>
            This only works while no crew has completed it. Once it has been used, those
            completions are evidence and the list is retired rather than removed.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        pending={isPending}
        onConfirm={() => run(() => deleteChecklist(id), `${name} deleted.`)}
      />
    </>
  );
}
