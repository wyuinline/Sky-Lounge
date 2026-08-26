import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/portal/reports/print-button";
import { reportDef } from "@/lib/report-defs";
import { runReport, reportStamp } from "../queries";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ report: string }>;
}) {
  const { report } = await params;
  if (!reportDef(report)) notFound();

  const result = await runReport(report);

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
          <AlertTitle>Report not available</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { def, rows } = result;
  const stamp = reportStamp();

  return (
    <div className="flex flex-col gap-5">
      {/* Controls, not part of the document — removed when printing. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/reports">
          <Button size="sm" variant="ghost">
            <ArrowLeft className="size-4" />
            All reports
          </Button>
        </Link>
        <div className="flex gap-2">
          <a href={`/api/reports/${def.id}`}>
            <Button size="sm" variant="outline">
              <FileSpreadsheet className="size-4" />
              Download CSV
            </Button>
          </a>
          <PrintButton />
        </div>
      </div>

      <article className="report flex flex-col gap-4">
        <header className="flex flex-col gap-1 border-b-2 border-foreground pb-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-teal uppercase">
            Inline Group Inc. — UAV Operations
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.015em]">{def.title}</h1>
          <p className="max-w-prose text-sm text-muted-foreground">{def.purpose}</p>
          <p className="pt-1 text-xs text-muted-foreground tabular-nums">
            Generated {stamp} · {rows.length} {rows.length === 1 ? "record" : "records"}
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No records to report. Nothing has been filed under this heading yet.
          </p>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {def.columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={`border-b border-border px-2 py-2 text-xs font-semibold tracking-[0.05em] text-brand-teal uppercase ${
                        c.numeric ? "text-right" : "text-left"
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="break-inside-avoid">
                    {def.columns.map((c) => {
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

        <footer className="border-t border-border pt-2 text-xs text-muted-foreground">
          Produced by the Inline Group UAV Operations Portal on {stamp}. Figures are derived from
          the operational record at the time of printing.
        </footer>
      </article>
    </div>
  );
}
