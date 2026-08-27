"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createManual } from "@/app/(portal)/documents/manual-actions";

export type ManualSummary = {
  id: string;
  title: string;
  revision: string;
  effective_date: string | null;
  approval_status: string;
  description: string | null;
  section_count: number;
  document_count: number;
  empty_section_count: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  published: "Published",
};

export function ManualsPanel({
  manuals,
  canManage,
}: {
  manuals: ManualSummary[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">
            A manual binds documents already in the library into a numbered structure with a
            contents page, so a finding can cite section 4.3 and mean the same thing next year.
            Numbers come from position — inserting a section renumbers what follows.
          </p>
          {canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New manual
            </Button>
          ) : null}
        </div>

        {manuals.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No manuals yet. An RPAS operations manual is the one a reviewer asks for first.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {manuals.map((manual) => (
              <li key={manual.id}>
                <Link
                  href={`/documents/manuals/${manual.id}`}
                  className="flex h-full flex-col gap-2 rounded-md border border-[var(--control-edge)] bg-[var(--control-face)] p-4 shadow-[var(--control-lift)] transition-shadow hover:shadow-[var(--control-lift-hover)]"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <BookOpen className="size-4 shrink-0 text-brand-teal" />
                    <span className="font-medium">{manual.title}</span>
                    <Badge variant={manual.approval_status === "published" ? "secondary" : "outline"}>
                      {STATUS_LABEL[manual.approval_status] ?? manual.approval_status}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Revision {manual.revision}
                    {manual.effective_date ? ` · effective ${manual.effective_date}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {manual.section_count} sections · {manual.document_count} referencing a
                    controlled document
                  </span>
                  {manual.empty_section_count > 0 ? (
                    <span className="text-xs text-[var(--status-warning)]">
                      {manual.empty_section_count} section
                      {manual.empty_section_count === 1 ? "" : "s"} still empty
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              const result = await createManual(new FormData(event.currentTarget));
              setSaving(false);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              setOpen(false);
              toast.success("Manual created. Add its sections next.");
              // Straight into the manual: an empty manual on a list is not
              // what the person came here to make.
              if (result.id) router.push(`/documents/manuals/${result.id}`);
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>New manual</DialogTitle>
              <DialogDescription>
                Start with the title and revision. Sections come next, on the manual&apos;s own
                page.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="manual_title">Title</Label>
              <Input
                id="manual_title"
                name="title"
                placeholder="RPAS Operations Manual"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual_revision">Revision</Label>
                <Input id="manual_revision" name="revision" defaultValue="1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual_effective">Effective date</Label>
                <Input id="manual_effective" name="effective_date" type="date" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="manual_description">Scope (optional)</Label>
              <Textarea id="manual_description" name="description" rows={2} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create manual"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
