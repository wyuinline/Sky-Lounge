import { CalendarClock, FileText, Lock } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { SectionLabel } from "@/components/portal/section-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DocumentsTable, type DocumentRow } from "@/components/portal/documents/documents-table";
import { UploadDocumentDialog } from "@/components/portal/documents/upload-document-dialog";
import { ManualsPanel, type ManualSummary } from "@/components/portal/documents/manuals-panel";
import { documentCategories } from "@/lib/document-categories";
import { reviewCycleLabel } from "@/lib/review-cycles";
import { deriveExpiryStatus, documentReviewDue } from "@/lib/compliance";
import { AttentionSummary } from "@/components/portal/attention-flag";
import { documentFlags, worstSeverity } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const [access, documentsRes, policyRes, manualsRes] = await Promise.all([
    getAccess(),
    // The view joins the pilot and exposes review_due for anything querying
    // SQL directly. This page derives the date itself, through the same tested
    // function the reminder scan uses, so there is one implementation of the
    // rule rather than two that can drift apart.
    supabase
      .from("document_review_status")
      .select(
        "id, title, category, version, approval_status, storage_path, created_at, effective_date, last_reviewed_at, review_interval_months, review_due, expires_at, pilot_name, uploaded_by",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("document_review_policy")
      .select("category, review_interval_months, rationale")
      .order("category"),
    // Section and document counts are derived by the view, so a manual's
    // completeness cannot drift from its actual contents.
    supabase.from("manual_summary").select("*").order("title"),
  ]);

  // Mapped rather than cast: a view carries no NOT NULL, so every column
  // arrives nullable and a blanket cast would hide a genuinely missing title
  // or category behind a type assertion.
  const documents: DocumentRow[] = (documentsRes.data ?? []).map((d) => ({
    id: d.id ?? "",
    title: d.title ?? "Untitled document",
    category: (d.category ?? "policy") as DocumentRow["category"],
    version: d.version ?? 1,
    approval_status: (d.approval_status ?? "draft") as DocumentRow["approval_status"],
    storage_path: d.storage_path ?? "",
    created_at: d.created_at ?? "",
    effective_date: d.effective_date,
    last_reviewed_at: d.last_reviewed_at,
    review_interval_months: d.review_interval_months,
    review_due: documentReviewDue({
      last_reviewed_at: d.last_reviewed_at,
      effective_date: d.effective_date,
      created_at: d.created_at,
      review_interval_months: d.review_interval_months,
    }),
    expires_at: d.expires_at,
    pilot_name: d.pilot_name,
  }));
  const canManage = access?.canManage("docs_general") ?? false;

  const reviewDefaults = Object.fromEntries(
    (policyRes.data ?? []).map((p) => [p.category, p.review_interval_months]),
  ) as Record<string, number | null>;

  const countsByCategory = documentCategories.map((c) => ({
    ...c,
    count: documents.filter((d) => d.category === c.value).length,
  }));

  const now = new Date();
  const onCycle = documents.filter((d) => d.review_due !== null);
  const overdue = onCycle.filter(
    (d) => deriveExpiryStatus(d.review_due, now) === "expired",
  ).length;
  const dueSoon = onCycle.filter(
    (d) => deriveExpiryStatus(d.review_due, now) === "due_soon",
  ).length;
  const neverReviewed = onCycle.filter((d) => d.last_reviewed_at === null).length;

  const flagged = documents.map((d) => worstSeverity(documentFlags(d, now)));
  const overdueCount = flagged.filter((s) => s === "overdue").length;
  const attentionCount = flagged.filter((s) => s === "attention").length;

  // Categories that carry a cycle, described once rather than repeated per row.
  const cyclePolicy = (policyRes.data ?? []).filter((p) => p.review_interval_months !== null);
  const noCyclePolicy = (policyRes.data ?? []).filter((p) => p.review_interval_months === null);

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Document Control"
        title="Document Management Center"
        subtitle="SOPs, policies, manuals, regulatory records, and safety materials — each on a review cycle so nothing quietly goes out of date."
        actions={canManage ? <UploadDocumentDialog reviewDefaults={reviewDefaults} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="On a Review Cycle" value={`${onCycle.length}`} tone="neutral" />
        <MetricTile
          label="Overdue for Review"
          value={`${overdue}`}
          tone={overdue > 0 ? "critical" : "good"}
        />
        <MetricTile
          label="Due Within 60 Days"
          value={`${dueSoon}`}
          tone={dueSoon > 0 ? "warning" : "good"}
        />
        <MetricTile
          label="Never Reviewed"
          value={`${neverReviewed}`}
          tone={neverReviewed > 0 ? "warning" : "good"}
        />
      </div>

      <div>
        <SectionLabel>Operations Manuals</SectionLabel>
        <ManualsPanel
          manuals={(manualsRes.data ?? []) as unknown as ManualSummary[]}
          canManage={canManage}
        />
      </div>

      <div>
        <SectionLabel>Document Libraries</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {countsByCategory.map((c) => (
            <Card key={c.value} className="gap-0 overflow-hidden rounded-md py-0">
              <div className="h-1 w-full bg-brand-sage" />
              <CardContent className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <FileText className="size-5 text-brand-teal" />
                <span className="text-xs font-medium">{c.label}</span>
                <span className="text-lg font-semibold tabular-nums">{c.count}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            Review cycles
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Most controlled documents carry no expiry date — they are valid until someone decides
            otherwise. What they need instead is a review: read it, confirm it still matches how the
            work is actually done, and mark it reviewed to restart the clock. These are the defaults
            suggested on upload; each document can be set individually.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cyclePolicy.map((p) => (
              <div key={p.category} className="flex items-baseline justify-between gap-3 border-l-2 border-brand-mist pl-3">
                <span className="text-sm">
                  {documentCategories.find((c) => c.value === p.category)?.label ?? p.category}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {reviewCycleLabel(p.review_interval_months)}
                </span>
              </div>
            ))}
          </div>
          {noCyclePolicy.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              No review needed:{" "}
              {noCyclePolicy
                .map(
                  (p) =>
                    documentCategories.find((c) => c.value === p.category)?.label ?? p.category,
                )
                .join(", ")}
              . A ROC-A radio certificate does not expire, and a filed incident report is a record
              of something that already happened.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <SectionLabel>All Documents</SectionLabel>
        <div className="mb-3">
          <AttentionSummary
            overdue={overdueCount}
            attention={attentionCount}
            noun="document library"
          />
        </div>
        <DocumentsTable rows={documents} canReview={canManage} />
      </div>

      <Alert>
        <CalendarClock />
        <AlertTitle>Who gets reminded</AlertTitle>
        <AlertDescription>
          The Wednesday reminder run flags documents at 60, 30, and 7 days before review, then again
          once overdue. Administrators are always told; when a document belongs to a specific pilot
          — a certificate on their file — that pilot is told as well, since they are the one who has
          to renew it.
        </AlertDescription>
      </Alert>

      <Alert>
        <Lock />
        <AlertTitle>Restricted categories</AlertTitle>
        <AlertDescription>
          If you cannot access a document, contact your administrator to request permission.
          Regulatory and incident report documents require elevated access, and signing off their
          review needs it too.
        </AlertDescription>
      </Alert>
    </div>
  );
}
