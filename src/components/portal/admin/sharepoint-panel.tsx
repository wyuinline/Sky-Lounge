"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SHAREPOINT_FOLDERS, NEVER_MIRRORED } from "@/lib/sharepoint";
import { checkSharePoint, remirrorDocument } from "@/app/(portal)/admin/integrations/actions";

export type MirrorRow = {
  id: string;
  title: string;
  category: string;
  sharepoint_url: string | null;
  sharepoint_synced_at: string | null;
  sharepoint_error: string | null;
};

export function SharePointPanel({
  configured,
  missing,
  documents,
}: {
  configured: boolean;
  missing: string[];
  documents: MirrorRow[];
}) {
  const [library, setLibrary] = useState<{ name: string; url: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [isPending, startTransition] = useTransition();

  const failed = documents.filter((d) => d.sharepoint_error !== null);
  const mirrored = documents.filter((d) => d.sharepoint_synced_at !== null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          The portal is the system of record. SharePoint holds a copy, so people find documents
          where they have always looked. The copy is one-way — editing a file in SharePoint does not
          change the portal&apos;s.
        </p>
      </div>

      {configured ? (
        <Alert>
          <CheckCircle2 className="size-4 text-[var(--status-good)]" />
          <AlertTitle>Configured</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              The Azure app registration and library are set on this deployment. Check the
              connection to confirm the permission grant is in place.
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={checking}
                onClick={async () => {
                  setChecking(true);
                  const result = await checkSharePoint();
                  setChecking(false);
                  if (result.error) {
                    setLibrary(null);
                    toast.error(result.error);
                    return;
                  }
                  setLibrary(result.library);
                  toast.success(`Connected to ${result.library?.name}.`);
                }}
              >
                <RefreshCw className="size-3.5" />
                {checking ? "Checking..." : "Check connection"}
              </Button>
              {library !== null ? (
                <a
                  className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                  href={library.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {library.name}
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </span>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <TriangleAlert className="size-4 text-[var(--status-warning)]" />
          <AlertTitle>Not configured</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Documents are held in the portal only. To mirror them, register an application in
              Azure with the <code className="font-mono text-xs">Sites.Selected</code> permission,
              grant it write access to the target site, then set these on the deployment:
            </span>
            <span className="flex flex-wrap gap-1.5">
              {missing.map((name) => (
                <Badge key={name} variant="outline" className="font-mono text-xs">
                  {name}
                </Badge>
              ))}
            </span>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Where documents land</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Library folder</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SHAREPOINT_FOLDERS).map(([category, folder]) => {
                const restricted = (NEVER_MIRRORED as string[]).includes(category);
                return (
                  <tr key={category} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{category}</td>
                    <td className="py-2 text-muted-foreground">
                      {restricted ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Never mirrored</Badge>
                          <span className="text-xs">
                            Restricted in the portal by role — a library has its own permissions.
                          </span>
                        </span>
                      ) : (
                        folder
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          Mirror status{" "}
          <span className="font-normal text-muted-foreground">
            — {mirrored.length} copied, {failed.length} failed
          </span>
        </h3>

        {failed.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {mirrored.length === 0
              ? "Nothing has been mirrored yet."
              : "Every mirrorable document has a copy in SharePoint."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {failed.map((document) => (
              <li
                key={document.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{document.title}</span>
                  <span className="text-xs text-[var(--status-critical)]">
                    {document.sharepoint_error}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await remirrorDocument(document.id);
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Copied to SharePoint.");
                    })
                  }
                >
                  <RefreshCw className="size-3.5" />
                  Retry
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
