"use client";

import { useState, useRef } from "react";
import { CircleAlert, Copy, Download, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OptionSelect } from "@/components/portal/option-select";
import {
  parseImport,
  summariseImport,
  templateCsv,
  type ImportSchema,
  type ParseResult,
  type DateFormat,
} from "@/lib/csv-import";
import { commitImport } from "@/app/(portal)/imports/actions";

const DATE_FORMATS = [
  { value: "dmy", label: "Day first — 03/04/2026 is 3 April" },
  { value: "mdy", label: "Month first — 03/04/2026 is 4 March" },
];

/** How many preview rows are worth rendering before it stops being a preview. */
const PREVIEW_LIMIT = 200;

function TemplateButton({ schema }: { schema: ImportSchema }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        // Copied rather than downloaded: a download would need a blob URL, and
        // pasting straight into a spreadsheet is what people actually do next.
        try {
          await navigator.clipboard.writeText(templateCsv(schema));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast.success("Template copied — paste it into a spreadsheet.");
        } catch {
          toast.info("Your browser blocked the clipboard. Type the headers listed below instead.");
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      Copy template
    </Button>
  );
}

export function ImportDialog({
  schema,
  canManage,
  buttonLabel,
}: {
  schema: ImportSchema;
  canManage: boolean;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormat | null>(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!canManage) return null;

  const reset = () => {
    setFileText(null);
    setFileName("");
    setResult(null);
    setDateFormat(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  /** Re-reads the held file whenever the date format changes under it. */
  const reparse = (text: string, format: DateFormat | null) => {
    setResult(parseImport(text, schema, format ?? undefined));
  };

  const summary = result && !result.error ? summariseImport(result.rows) : null;
  const required = schema.fields.filter((f) => f.required).map((f) => f.label);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Import ${schema.label} from a spreadsheet`}
      >
        <Upload className="size-4" />
        {buttonLabel ?? "Import"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import {schema.label}</DialogTitle>
            <DialogDescription>
              Save your spreadsheet as CSV and choose it here. Columns are matched by their
              headings, so you do not need to rename or reorder anything. Nothing is written until
              you have seen what would land.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="import_file">CSV file</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="import_file"
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="max-w-sm"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    setFileText(text);
                    setFileName(file.name);
                    setDateFormat(null);
                    reparse(text, null);
                  }}
                />
                <TemplateButton schema={schema} />
              </div>
              <p className="text-xs text-muted-foreground">
                Needs a column for {required.join(" and ")}. Everything else is optional and can be
                filled in later.
              </p>
            </div>

            {result?.error ? (
              <Alert>
                <CircleAlert className="size-4 text-[var(--status-critical)]" />
                <AlertTitle>That file cannot be imported</AlertTitle>
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            ) : null}

            {result && !result.error && summary ? (
              <>
                {result.dateAmbiguous ? (
                  <Alert>
                    <CircleAlert className="size-4 text-[var(--status-warning)]" />
                    <AlertTitle>Which way round are the dates?</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2">
                      <span>
                        Every date in this file could be read either way, and guessing wrong would
                        move a certificate expiry by up to eleven months. Reading them day-first for
                        now — change it if that is wrong.
                      </span>
                      <OptionSelect
                        value={dateFormat ?? "dmy"}
                        onValueChange={(value) => {
                          const next = value as DateFormat;
                          setDateFormat(next);
                          if (fileText) reparse(fileText, next);
                        }}
                        options={DATE_FORMATS}
                        className="max-w-sm"
                      />
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">{summary.ready} ready</Badge>
                  {summary.withErrors > 0 ? (
                    <Badge variant="outline" className="text-[var(--status-critical)]">
                      {summary.withErrors} with problems
                    </Badge>
                  ) : null}
                  {summary.duplicates > 0 ? (
                    <Badge variant="outline">{summary.duplicates} repeated in the file</Badge>
                  ) : null}
                  <span className="text-muted-foreground">
                    from {summary.total} rows in {fileName}
                  </span>
                </div>

                {result.unmatchedHeaders.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Columns not used: {result.unmatchedHeaders.join(", ")}. The portal has nowhere
                    to put these, and they are ignored.
                  </p>
                ) : null}

                <div className="max-h-72 overflow-auto rounded-md border">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">
                          {schema.fields.find((f) => f.column === schema.naturalKey)?.label}
                        </th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, PREVIEW_LIMIT).map((row) => {
                        const problem =
                          row.errors.length > 0
                            ? row.errors.map((e) => `${e.column}: ${e.message}`).join("; ")
                            : row.duplicateOfLine !== null
                              ? `Repeats row ${row.duplicateOfLine} — only the first will be imported`
                              : null;

                        return (
                          <tr key={row.line} className="border-t border-border/60">
                            <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                              {row.line}
                            </td>
                            <td className="px-3 py-1.5">
                              {String(row.values[schema.naturalKey] ?? "—")}
                            </td>
                            <td
                              className={`px-3 py-1.5 ${
                                row.errors.length > 0
                                  ? "text-[var(--status-critical)]"
                                  : row.duplicateOfLine !== null
                                    ? "text-[var(--status-warning)]"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {problem ?? "Ready"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {result.rows.length > PREVIEW_LIMIT ? (
                  <p className="text-xs text-muted-foreground">
                    Showing the first {PREVIEW_LIMIT} rows. All {result.rows.length} will be
                    imported.
                  </p>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Rows with problems are left out — nothing is half-imported. Anything already in
                  the portal is skipped rather than overwritten, so re-running the same file is
                  safe.
                </p>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              disabled={!summary || summary.ready === 0 || importing}
              onClick={async () => {
                if (!fileText) return;
                setImporting(true);
                const outcome = await commitImport(
                  schema.entity,
                  fileText,
                  dateFormat ?? result?.dateFormat,
                );
                setImporting(false);

                if (outcome.error) {
                  toast.error(outcome.error);
                  // A partial import still changed things; the preview is stale.
                  if (outcome.imported > 0) {
                    setOpen(false);
                    reset();
                  }
                  return;
                }

                setOpen(false);
                reset();
                toast.success(
                  `Imported ${outcome.imported} ${schema.label}` +
                    (outcome.skippedExisting > 0
                      ? `. ${outcome.skippedExisting} were already here and were left alone.`
                      : "."),
                );
              }}
            >
              <Download className="size-4" />
              {importing
                ? "Importing..."
                : summary
                  ? `Import ${summary.ready} ${schema.label}`
                  : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
