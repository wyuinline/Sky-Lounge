import Link from "next/link";
import { FileSpreadsheet, FileText, ArrowRight, ShieldCheck } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { reportDefs } from "@/lib/report-defs";
import { getAccess } from "@/lib/permissions";

export default async function ReportsPage() {
  const access = await getAccess();

  // Reports are gated on the area they read, so someone with fleet visibility
  // but no crew records sees the fleet report and not the currency one.
  const available = reportDefs.map((def) => ({
    def,
    allowed: access?.canReadAll(def.area) ?? false,
  }));

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Compliance Records"
        title="Reports"
        subtitle="The evidence a Transport Canada review asks for, assembled from the records you already keep."
      />

      {/* The pack sits above the individual reports because it is the one a
          regulator asks for, and the others are its parts. */}
      <Card className="gap-0 rounded-md border-[var(--control-edge)] py-0">
        <div className="h-1 w-full bg-brand-lime" />
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-teal" />
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold tracking-[-0.01em]">
                RPAS Operator Certificate — evidence pack
              </h2>
              <p className="max-w-prose text-sm text-muted-foreground">
                Everything an RPOC application or review asks for, assembled from records the
                portal already keeps: documented procedures at their current revision, crew
                credentials and authorisations, airworthiness, the hazard register, checklists,
                corrective actions and the occurrence record. Empty sections are marked as gaps
                rather than omitted.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/reports/rpoc">
              <Button size="sm">
                Open evidence pack
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {available.map(({ def, allowed }) => (
          <Card
            key={def.id}
            className="flex flex-col gap-0 rounded-md border-[var(--control-edge)] py-0"
          >
            <CardContent className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 size-5 shrink-0 text-brand-teal" />
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold tracking-[-0.01em]">{def.title}</h2>
                  <p className="text-sm text-muted-foreground">{def.purpose}</p>
                </div>
              </div>

              {allowed ? (
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Link href={`/reports/${def.id}`}>
                    <Button size="sm" variant="outline">
                      Open
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                  <a href={`/api/reports/${def.id}`}>
                    <Button size="sm" variant="ghost">
                      <FileSpreadsheet className="size-4" />
                      CSV
                    </Button>
                  </a>
                </div>
              ) : (
                <p className="mt-auto pt-1 text-xs text-muted-foreground">
                  Needs full visibility of {def.area.replace("_", " ")} to run.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert>
        <FileText />
        <AlertTitle>Producing a PDF</AlertTitle>
        <AlertDescription>
          Open a report and print it — the page is laid out for paper, with the navigation removed
          and the table repeating its headers across pages. Choose &ldquo;Save as PDF&rdquo; as the
          destination. The CSV is for working with the figures rather than filing them.
        </AlertDescription>
      </Alert>
    </div>
  );
}
