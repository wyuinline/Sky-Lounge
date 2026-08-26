import { NextResponse } from "next/server";
import { runReport, reportStamp } from "@/app/(portal)/reports/queries";
import { toCsv, csvFilename, type CsvValue } from "@/lib/csv";

/**
 * A report as a CSV download.
 *
 * Shares runReport with the printable page, so the two cannot disagree, and
 * inherits its permission check — the proxy lets API routes through without a
 * session redirect, so the authorisation has to happen here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ report: string }> },
) {
  const { report } = await params;
  const result = await runReport(report);

  if (result.error !== null) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  const { def, rows } = result;
  const body = toCsv(
    def.columns.map((c) => c.label),
    rows.map((row) => def.columns.map((c) => row[c.key] as CsvValue)),
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(def.id, reportStamp())}"`,
      // A compliance extract should never be served from a shared cache.
      "Cache-Control": "no-store, private",
    },
  });
}
