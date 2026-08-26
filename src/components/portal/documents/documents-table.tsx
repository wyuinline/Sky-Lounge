"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { StatusDot } from "@/components/portal/status-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { documentCategories, labelForCategory, type DocumentCategory } from "@/lib/document-categories";
import { reviewCycleShort } from "@/lib/review-cycles";
import { deriveExpiryStatus, daysUntil, type ExpiryStatus } from "@/lib/compliance";
import { getDownloadUrl, markDocumentReviewed } from "@/app/(portal)/documents/actions";
import { AttentionFlag } from "@/components/portal/attention-flag";
import { documentFlags } from "@/lib/flags";

export type DocumentRow = {
  id: string;
  title: string;
  category: DocumentCategory;
  version: number;
  approval_status: "draft" | "pending_approval" | "approved" | "published";
  storage_path: string;
  created_at: string;
  effective_date: string | null;
  last_reviewed_at: string | null;
  review_interval_months: number | null;
  review_due: string | null;
  expires_at: string | null;
  pilot_name: string | null;
};

const approvalTone: Record<DocumentRow["approval_status"], "neutral" | "warning" | "good"> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "good",
  published: "good",
};

const reviewTone: Record<ExpiryStatus, "good" | "warning" | "critical"> = {
  current: "good",
  due_soon: "warning",
  expired: "critical",
};

/**
 * How a document's review state reads in one cell.
 *
 * Null means the document genuinely never needs reviewing, which has to look
 * different from "in date" — otherwise a ROC-A shows a green tick implying
 * someone checked it recently, and nobody did.
 */
function reviewStatus(row: DocumentRow, now: Date): ExpiryStatus | null {
  if (!row.review_due) return null;
  return deriveExpiryStatus(row.review_due, now);
}

export function DocumentsTable({
  rows,
  canReview,
}: {
  rows: DocumentRow[];
  canReview: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (category !== "all" && row.category !== category) return false;
      if (search.trim() !== "" && !row.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (reviewFilter !== "all") {
        const status = reviewStatus(row, now);
        if (reviewFilter === "needs_review") {
          if (status !== "expired" && status !== "due_soon") return false;
        } else if (reviewFilter === "overdue") {
          if (status !== "expired") return false;
        } else if (reviewFilter === "no_cycle") {
          if (status !== null) return false;
        }
      }
      return true;
    });
  }, [rows, search, category, reviewFilter, now]);

  async function handleDownload(row: DocumentRow) {
    setDownloadingId(row.id);
    const result = await getDownloadUrl(row.storage_path, row.category);
    setDownloadingId(null);

    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not generate download link.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  function handleReview(row: DocumentRow) {
    setReviewingId(row.id);
    startTransition(async () => {
      const result = await markDocumentReviewed(row.id);
      setReviewingId(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${row.title}" marked reviewed. The clock restarts today.`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {documentCategories.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={(v) => setReviewFilter(v ?? "all")}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any review state</SelectItem>
            <SelectItem value="needs_review">Needs review soon</SelectItem>
            <SelectItem value="overdue">Overdue only</SelectItem>
            <SelectItem value="no_cycle">No review cycle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Last Reviewed</TableHead>
              <TableHead>Review Due</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No documents uploaded yet." : "No documents match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const status = reviewStatus(row, now);
                const days = daysUntil(row.review_due, now);
                const expiryStatus = row.expires_at
                  ? deriveExpiryStatus(row.expires_at, now)
                  : null;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="pr-0">
                      <AttentionFlag flags={documentFlags(row, now)} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.title}
                      {row.pilot_name ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {row.pilot_name}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{labelForCategory(row.category)}</TableCell>
                    <TableCell>v{row.version}</TableCell>
                    <TableCell>
                      <StatusDot
                        tone={approvalTone[row.approval_status]}
                        label={row.approval_status.replace("_", " ")}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {reviewCycleShort(row.review_interval_months)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.last_reviewed_at ?? (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {status === null ? (
                        <span className="text-sm text-muted-foreground">Not required</span>
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          <StatusDot tone={reviewTone[status]} label={row.review_due ?? ""} />
                          {days !== null ? (
                            <span className="text-xs text-muted-foreground">
                              {days < 0
                                ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
                                : `in ${days} day${days === 1 ? "" : "s"}`}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.expires_at && expiryStatus ? (
                        <StatusDot tone={reviewTone[expiryStatus]} label={row.expires_at} />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {canReview && status !== null ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewingId === row.id}
                            onClick={() => handleReview(row)}
                            title="Record that you have read this and it still stands"
                          >
                            <CheckCheck className="size-4" />
                            {reviewingId === row.id ? "Saving..." : "Reviewed"}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={downloadingId === row.id}
                          onClick={() => handleDownload(row)}
                          aria-label={`Download ${row.title}`}
                        >
                          <Download className="size-4" />
                        </Button>
                      </div>
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
