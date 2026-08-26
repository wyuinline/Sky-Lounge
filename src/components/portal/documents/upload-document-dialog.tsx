"use client";

import { useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { documentCategories, labelForCategory, type DocumentCategory } from "@/lib/document-categories";
import { reviewCycleOptions, reviewCycleLabel, NEVER_REVIEW } from "@/lib/review-cycles";
import { uploadDocument } from "@/app/(portal)/documents/actions";

export function UploadDocumentDialog({
  reviewDefaults,
}: {
  /** Per-category default review cycle, from the document_review_policy table. */
  reviewDefaults: Record<string, number | null>;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>("sop");
  // Kept as a string so "never" is a first-class choice rather than a missing
  // value that could be mistaken for "not filled in yet".
  const [reviewCycle, setReviewCycle] = useState<string>(
    String(reviewDefaults.sop ?? NEVER_REVIEW),
  );
  const [loading, setLoading] = useState(false);

  /** Following the category keeps the common case correct without forcing it. */
  function chooseCategory(next: DocumentCategory) {
    setCategory(next);
    setReviewCycle(String(reviewDefaults[next] ?? NEVER_REVIEW));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.set("category", category);
    formData.set("review_interval_months", reviewCycle === NEVER_REVIEW ? "" : reviewCycle);
    const result = await uploadDocument(formData);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Document uploaded.");
    setOpen(false);
    setCategory("sop");
    setReviewCycle(String(reviewDefaults.sop ?? NEVER_REVIEW));
    event.currentTarget.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Upload className="size-4" />
          Upload New Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload New Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Pre-Flight Checklist v3" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => chooseCategory((v as DocumentCategory) ?? "sop")}
            >
              <SelectTrigger className="w-full">
                {/* Base UI renders the raw value unless told otherwise, and
                    "sop" is not what anyone means to read. */}
                <SelectValue>{(v) => labelForCategory(v as DocumentCategory)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {documentCategories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="uav_model">UAV Model (optional)</Label>
              <Input id="uav_model" name="uav_model" placeholder="Matrice 350 RTK" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="department">Department (optional)</Label>
              <Input id="department" name="department" placeholder="Flight Operations" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="effective_date">Effective From</Label>
              <Input id="effective_date" name="effective_date" type="date" />
              <p className="text-xs text-muted-foreground">
                When this version took effect. Defaults to today; the review clock starts here.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expires_at">Expiry Date (optional)</Label>
              <Input id="expires_at" name="expires_at" type="date" />
              <p className="text-xs text-muted-foreground">
                Only if a date is printed on the document itself.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Review Cycle</Label>
            <Select value={reviewCycle} onValueChange={(v) => v && setReviewCycle(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) =>
                    v === NEVER_REVIEW ? "Never — no review needed" : reviewCycleLabel(Number(v))
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {reviewCycleOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Suggested by the category, and changeable. SOPs and manuals are read once a year; a
              ROC-A never expires and needs no review.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
