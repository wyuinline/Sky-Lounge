import { FileText, Lock } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { SectionLabel } from "@/components/portal/section-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DocumentsTable, type DocumentRow } from "@/components/portal/documents/documents-table";
import { UploadDocumentDialog } from "@/components/portal/documents/upload-document-dialog";
import { documentCategories } from "@/lib/document-categories";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const [access, documentsRes] = await Promise.all([
    getAccess(),
    supabase
      .from("documents")
      .select("id, title, category, version, approval_status, storage_path, created_at, uploader:uploaded_by(full_name)")
      .order("created_at", { ascending: false })
,
  ]);

  const documents = documentsRes.data ?? [];
  const canManage = access?.canManage("docs_general") ?? false;

  const countsByCategory = documentCategories.map((c) => ({
    ...c,
    count: documents.filter((d) => d.category === c.value).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Document Control"
        title="Document Management Center"
        subtitle="Centralized access to SOPs, policies, flight manuals, maintenance manuals, regulatory documents, and safety materials."
        actions={canManage ? <UploadDocumentDialog /> : undefined}
      />

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
            Document Standards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Every document is tagged with category, UAV model, and department metadata on upload</li>
            <li>Regulatory Documents and Incident Reports follow the &ldquo;Documents — restricted&rdquo; row of the access matrix</li>
            <li>Each document tracks a version number and an approval status (draft, pending, approved, published)</li>
            <li>Search and filter by title or category from the library below</li>
          </ul>
        </CardContent>
      </Card>

      <DocumentsTable rows={documents} />

      <Alert>
        <Lock />
        <AlertTitle>Restricted categories</AlertTitle>
        <AlertDescription>
          If you cannot access a document, contact your administrator to request permission. Regulatory
          and incident report documents require elevated access.
        </AlertDescription>
      </Alert>
    </div>
  );
}
