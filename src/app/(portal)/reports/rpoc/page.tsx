import Link from "next/link";
import { ArrowLeft, TriangleAlert, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/portal/reports/print-button";
import { buildEvidencePack } from "../rpoc";

export default async function RpocEvidencePage() {
  const result = await buildEvidencePack();

  if (result.error !== null) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/reports" className="w-fit">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="size-4" />
            All reports
          </Button>
        </Link>
        <Alert>
          <AlertTitle>Evidence pack not available</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { pack } = result;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/reports">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="size-4" />
            All reports
          </Button>
        </Link>
        <PrintButton />
      </div>

      {pack.gaps.length > 0 ? (
        <Alert className="print:hidden">
          <TriangleAlert />
          <AlertTitle>
            {pack.gaps.length} section{pack.gaps.length === 1 ? " is" : "s are"} empty
          </AlertTitle>
          <AlertDescription>
            {pack.gaps.join(", ")}. An empty section is a gap in the submission, not a formatting
            problem — each one is marked in the document below so a reviewer sees the same thing you
            do.
          </AlertDescription>
        </Alert>
      ) : null}

      <article className="report flex flex-col gap-6">
        <header className="flex flex-col gap-1 border-b-2 border-foreground pb-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-teal uppercase">
            {pack.organisation} — UAV Operations
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.015em]">
            RPAS Operator Certificate — evidence pack
          </h1>
          {pack.rpocNumber ? (
            <p className="text-sm tabular-nums">Certificate {pack.rpocNumber}</p>
          ) : (
            <p className="text-sm text-[var(--status-warning)] print:text-black">
              No operator certificate number on record. Set it under Administration →
              Organisation before submitting this.
            </p>
          )}
          <p className="max-w-prose text-sm text-muted-foreground">
            Assembled from the operational record for a Transport Canada RPOC application or
            review. Each section states what it is evidence of; sections with no records say so
            rather than being omitted.
          </p>
          <p className="pt-1 text-xs text-muted-foreground tabular-nums">
            Generated {pack.generatedOn} · {pack.sections.length} sections ·{" "}
            {pack.sections.reduce((n, s) => n + s.rows.length, 0)} records
          </p>
        </header>

        {pack.sections.map((section, index) => (
          <section key={section.id} className="flex break-inside-avoid flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-semibold tracking-[-0.01em]">
                <span className="text-brand-teal tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>{" "}
                {section.title}
              </h2>
              <p className="max-w-prose text-xs text-muted-foreground">{section.purpose}</p>
            </div>

            {section.rows.length === 0 ? (
              <p className="rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/8 px-3 py-2 text-sm text-[var(--status-warning)]">
                {section.gapWarning}
              </p>
            ) : (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {section.columns.map((c) => (
                        <th
                          key={c.key}
                          scope="col"
                          className={`border-b border-border px-2 py-1.5 text-xs font-semibold tracking-[0.05em] text-brand-teal uppercase ${
                            c.numeric ? "text-right" : "text-left"
                          }`}
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, i) => (
                      <tr key={i} className="break-inside-avoid">
                        {section.columns.map((c) => {
                          const value = row[c.key];
                          return (
                            <td
                              key={c.key}
                              className={`border-b border-border px-2 py-1.5 align-top ${
                                c.numeric ? "text-right tabular-nums" : "text-left"
                              }`}
                            >
                              {value === null || value === undefined || value === "" ? (
                                <span className="text-muted-foreground">—</span>
                              ) : typeof value === "boolean" ? (
                                value ? "Yes" : "No"
                              ) : (
                                String(value)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        <footer className="border-t border-border pt-2 text-xs text-muted-foreground">
          Produced by the {pack.organisation} UAV Operations Portal on {pack.generatedOn}. Every
          figure is derived from the operational record at the time of printing; nothing in this
          document is maintained separately from the system that runs the operation.
        </footer>
      </article>

      <Alert className="print:hidden">
        <ShieldCheck />
        <AlertTitle>What this pack is for</AlertTitle>
        <AlertDescription>
          Since 4 November 2025, beyond-line-of-sight work requires an RPAS Operator Certificate,
          and holding one means keeping documented policies and procedures proportionate to the
          operation. This assembles that evidence from records the portal already keeps — print it
          to PDF for a submission, or run it before an audit to find the gaps while there is still
          time to close them.
        </AlertDescription>
      </Alert>
    </div>
  );
}
