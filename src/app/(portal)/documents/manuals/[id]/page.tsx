import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/portal/reports/print-button";
import { ManualEditor, type ManualSection } from "@/components/portal/documents/manual-editor";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { labelForCategory, type DocumentCategory } from "@/lib/document-categories";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  published: "Published",
};

export default async function ManualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await getAccess();

  if (!access) redirect("/login");
  if (!access.canReadAll("docs_general")) redirect("/");

  const [{ data: manual }, { data: sections }, { data: documents }] = await Promise.all([
    supabase.from("manual_summary").select("*").eq("id", id).maybeSingle(),
    // Ordered by the derived path, so this array is the manual front to back.
    supabase.from("manual_contents").select("*").eq("manual_id", id).order("sort_path"),
    supabase
      .from("documents")
      .select("id, title, category, version")
      .order("title"),
  ]);

  if (!manual) notFound();

  const rows = (sections ?? []) as unknown as ManualSection[];
  const canManage = access.canManage("docs_general");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button size="sm" variant="ghost" render={<Link href="/documents" />}>
          <ArrowLeft className="size-4" />
          Back to documents
        </Button>
        <PrintButton />
      </div>

      <article className="report flex flex-col gap-6">
        <header className="flex flex-col gap-2 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">{manual.title}</h1>
            <Badge variant={manual.approval_status === "published" ? "secondary" : "outline"}>
              {STATUS_LABEL[manual.approval_status ?? "draft"] ?? manual.approval_status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Revision {manual.revision}
            {manual.effective_date ? ` · effective ${manual.effective_date}` : ""} ·{" "}
            {manual.section_count} sections, {manual.document_count} referencing a controlled
            document
          </p>
          {manual.description ? <p className="text-sm">{manual.description}</p> : null}
          {(manual.empty_section_count ?? 0) > 0 ? (
            <p className="text-sm text-[var(--status-warning)]">
              {manual.empty_section_count} section
              {manual.empty_section_count === 1 ? "" : "s"} with nothing in them. A reviewer finds
              these first.
            </p>
          ) : null}
        </header>

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            This manual has no sections yet.
          </p>
        ) : (
          <>
            <nav aria-labelledby="contents-heading" className="flex flex-col gap-2">
              <h2 id="contents-heading" className="text-sm font-semibold tracking-[-0.01em]">
                Contents
              </h2>
              <ol className="flex flex-col gap-1 text-sm">
                {rows.map((section) => (
                  <li
                    key={section.section_id}
                    style={{ paddingInlineStart: `${(section.depth - 1) * 1.25}rem` }}
                  >
                    <a
                      href={`#section-${section.section_id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      <span className="tabular-nums text-muted-foreground">
                        {section.section_number}
                      </span>{" "}
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="flex flex-col gap-5">
              {rows.map((section) => (
                <section
                  key={section.section_id}
                  id={`section-${section.section_id}`}
                  className="flex flex-col gap-1.5 break-inside-avoid"
                  style={{ paddingInlineStart: `${(section.depth - 1) * 1}rem` }}
                >
                  <h3
                    className={
                      section.depth === 1
                        ? "text-base font-semibold tracking-[-0.01em]"
                        : "text-sm font-semibold"
                    }
                  >
                    <span className="tabular-nums text-muted-foreground">
                      {section.section_number}
                    </span>{" "}
                    {section.heading}
                  </h3>

                  {section.document_id ? (
                    <p className="text-sm text-muted-foreground">
                      Refer to{" "}
                      <span className="font-medium text-foreground">
                        {section.document_title}
                      </span>{" "}
                      (
                      {labelForCategory(section.document_category as DocumentCategory)}, version{" "}
                      {section.document_version}
                      {section.document_effective_date
                        ? `, effective ${section.document_effective_date}`
                        : ""}
                      ), held in the document library.
                    </p>
                  ) : section.body ? (
                    <p className="text-sm whitespace-pre-wrap">{section.body}</p>
                  ) : (
                    <p className="text-sm text-[var(--status-warning)] print:text-black">
                      Nothing recorded against this section yet.
                    </p>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </article>

      {canManage ? (
        <div className="print:hidden">
          <ManualEditor
            manualId={id}
            sections={rows}
            documents={(documents ?? []).map((d) => ({
              id: d.id,
              label: `${d.title} (v${d.version})`,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}
