"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import {
  addManualSection,
  deleteManualSection,
  moveManualSection,
} from "@/app/(portal)/documents/manual-actions";
import { TOP_LEVEL, NO_DOCUMENT } from "@/lib/manual-constants";

export type ManualSection = {
  section_id: string;
  manual_id: string;
  parent_id: string | null;
  section_number: string;
  heading: string;
  depth: number;
  sort_order: number;
  sort_path: string;
  body: string | null;
  document_id: string | null;
  document_title: string | null;
  document_category: string | null;
  document_version: number | null;
  document_effective_date: string | null;
  document_storage_path: string | null;
};

type DocumentOption = { id: string; label: string };

function AddSectionDialog({
  manualId,
  sections,
  documents,
}: {
  manualId: string;
  sections: ManualSection[];
  documents: DocumentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState(TOP_LEVEL);
  const [documentId, setDocumentId] = useState(NO_DOCUMENT);
  const [saving, setSaving] = useState(false);

  // One level of nesting: only top-level sections can be parents, which is what
  // keeps a contents page readable.
  const parents = sections.filter((s) => s.depth === 1);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add section
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              const form = event.currentTarget;
              const formData = new FormData(form);
              formData.set("parent_id", parentId);
              formData.set("document_id", documentId === NO_DOCUMENT ? "" : documentId);

              const result = await addManualSection(manualId, formData);
              setSaving(false);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              form.reset();
              setParentId(TOP_LEVEL);
              setDocumentId(NO_DOCUMENT);
              setOpen(false);
              toast.success("Section added.");
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Add a section</DialogTitle>
              <DialogDescription>
                Sections are numbered by position, so this one takes its number from where it lands
                — and everything below renumbers itself.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="heading">Heading</Label>
              <Input id="heading" name="heading" placeholder="Pre-flight procedures" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Sits under</Label>
              <Select value={parentId} onValueChange={(v) => setParentId(v ?? TOP_LEVEL)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) =>
                      v === TOP_LEVEL
                        ? "Top level"
                        : (() => {
                            const parent = parents.find((p) => p.section_id === v);
                            return parent
                              ? `${parent.section_number} ${parent.heading}`
                              : "Top level";
                          })()
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TOP_LEVEL}>Top level</SelectItem>
                  {parents.map((parent) => (
                    <SelectItem key={parent.section_id} value={parent.section_id}>
                      {parent.section_number} {parent.heading}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Points at a controlled document</Label>
              <Select value={documentId} onValueChange={(v) => setDocumentId(v ?? NO_DOCUMENT)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) =>
                      v === NO_DOCUMENT
                        ? "No — this section has its own text"
                        : (documents.find((d) => d.id === v)?.label ??
                          "No — this section has its own text")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DOCUMENT}>No — this section has its own text</SelectItem>
                  {documents.map((document) => (
                    <SelectItem key={document.id} value={document.id}>
                      {document.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A pointer keeps the document versioned in its own library, so the manual always
                cites the current revision.
              </p>
            </div>

            {documentId === NO_DOCUMENT ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="body">Section text</Label>
                <Textarea
                  id="body"
                  name="body"
                  rows={5}
                  placeholder="The narrative this section carries. Leave blank for a heading that only groups the sections beneath it."
                />
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Adding..." : "Add section"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Rearranging a manual.
 *
 * Kept below the manual itself rather than inline with it: the page above is
 * what gets printed and handed to a reviewer, and controls interleaved with
 * the text would make it hard to read as the document it is.
 */
export function ManualEditor({
  manualId,
  sections,
  documents,
}: {
  manualId: string;
  sections: ManualSection[];
  documents: DocumentOption[];
}) {
  const [removing, setRemoving] = useState<ManualSection | null>(null);
  const [isPending, startTransition] = useTransition();

  const move = (sectionId: string, direction: "up" | "down") =>
    startTransition(async () => {
      const result = await moveManualSection(manualId, sectionId, direction);
      if (result.error) toast.error(result.error);
    });

  return (
    <>
      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Structure</h2>
            <p className="text-xs text-muted-foreground">
              Numbers come from position. Moving a section renumbers it and everything below.
            </p>
          </div>
          <AddSectionDialog manualId={manualId} sections={sections} documents={documents} />
        </div>

        {sections.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Start with the top-level sections, then add the ones that sit under them.
          </p>
        ) : (
          <ul className="flex flex-col">
            {sections.map((section) => {
              const siblings = sections.filter((s) => s.parent_id === section.parent_id);
              const position = siblings.findIndex((s) => s.section_id === section.section_id);
              return (
              <li
                key={section.section_id}
                className="flex items-center gap-2 border-b border-border/60 py-2 last:border-0"
                style={{ paddingInlineStart: `${(section.depth - 1) * 1.5}rem` }}
              >
                <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {section.section_number}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {section.heading}
                  {section.document_id ? (
                    <Badge variant="outline" className="ml-2 align-middle">
                      Document
                    </Badge>
                  ) : null}
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move ${section.heading} up`}
                    disabled={isPending || position === 0}
                    onClick={() => move(section.section_id, "up")}
                  >
                    <ChevronUp className="size-3" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move ${section.heading} down`}
                    disabled={isPending || position === siblings.length - 1}
                    onClick={() => move(section.section_id, "down")}
                  >
                    <ChevronDown className="size-3" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Remove ${section.heading}`}
                    onClick={() => setRemoving(section)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
        title={`Remove section ${removing?.section_number ?? ""}?`}
        description={
          <>
            The section and anything nested under it are removed from the manual, and every section
            below renumbers. Documents it pointed at are untouched — they stay in the library.
          </>
        }
        confirmLabel="Remove section"
        destructive
        pending={isPending}
        onConfirm={() =>
          startTransition(async () => {
            if (removing === null) return;
            const result = await deleteManualSection(manualId, removing.section_id);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            setRemoving(null);
            toast.success("Section removed.");
          })
        }
      />
    </>
  );
}
