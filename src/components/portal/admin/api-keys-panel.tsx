"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plus, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/portal/confirm-dialog";
import { accessAreaLabel, type AccessArea } from "@/lib/access";
import { apiScopes, KEY_PREFIX } from "@/lib/api-keys";
import { createApiKey, revokeApiKey } from "@/app/(portal)/admin/integrations/actions";

export type ApiKeyRow = {
  id: string;
  name: string;
  key_hint: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

/** A value the person has to get out of the browser and into another system. */
function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-stretch gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-[var(--control-edge)] bg-muted px-3 py-2 font-mono text-xs whitespace-nowrap">
        {value}
      </code>
      <Button
        size="icon"
        variant="outline"
        aria-label="Copy to clipboard"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // A blocked clipboard is not something the person can fix, and the
            // value is on screen and selectable either way.
            toast.info("Select the text and copy it manually.");
          }
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

function shortDate(iso: string | null): string {
  return iso === null ? "—" : iso.slice(0, 10);
}

export function ApiKeysPanel({ keys }: { keys: ApiKeyRow[] }) {
  const [open, setOpen] = useState(false);
  const [minted, setMinted] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
  const [isPending, startTransition] = useTransition();

  // Live keys first: a revoked key is history, and history belongs below.
  const ordered = [
    ...keys.filter((k) => k.revoked_at === null),
    ...keys.filter((k) => k.revoked_at !== null),
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">
            A key reads the portal through <code className="font-mono text-xs">/api/v1</code>. It
            can never write anything, and it only sees the areas you tick.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New API key
          </Button>
        </div>

        {ordered.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No keys yet. Create one when you connect a dashboard or a scheduled export.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Key</th>
                  <th className="pb-2 font-medium">Reads</th>
                  <th className="pb-2 font-medium">Last used</th>
                  <th className="pb-2 font-medium">Expires</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {ordered.map((key) => (
                  <tr key={key.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 align-top font-medium">
                      {key.name}
                      {key.revoked_at !== null ? (
                        <Badge variant="outline" className="ml-2 align-middle">
                          Revoked {shortDate(key.revoked_at)}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 align-top font-mono text-xs text-muted-foreground">
                      {KEY_PREFIX}
                      {key.key_hint}…
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      <span className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <Badge key={s} variant="secondary">
                            {accessAreaLabel[s as AccessArea] ?? s}
                          </Badge>
                        ))}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 align-top tabular-nums text-muted-foreground">
                      {key.last_used_at === null ? "Never" : shortDate(key.last_used_at)}
                    </td>
                    <td className="py-2.5 pr-3 align-top tabular-nums text-muted-foreground">
                      {shortDate(key.expires_at)}
                    </td>
                    <td className="py-2.5 text-right align-top">
                      {key.revoked_at === null ? (
                        <Button size="xs" variant="ghost" onClick={() => setRevoking(key)}>
                          <Ban className="size-3" />
                          Revoke
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setMinted(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {minted === null ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                const result = await createApiKey(new FormData(event.currentTarget));
                setSaving(false);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                setMinted(result.secret);
              }}
              className="flex flex-col gap-4"
            >
              <DialogHeader>
                <DialogTitle>New API key</DialogTitle>
                <DialogDescription>
                  The key is shown once, when you create it. Copy it then — it cannot be read back
                  afterwards.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                <Label htmlFor="key_name">Name</Label>
                <Input id="key_name" name="name" placeholder="Power BI — fleet dashboard" required />
                <p className="text-xs text-muted-foreground">
                  Name it after what will use it, so you know what breaks if you revoke it.
                </p>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">This key may read</legend>
                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {apiScopes.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 text-sm">
                      <Checkbox name="scopes" value={scope} />
                      {accessAreaLabel[scope]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-2">
                <Label htmlFor="key_expires">Expires (optional)</Label>
                <Input id="key_expires" name="expires_at" type="date" />
                <p className="text-xs text-muted-foreground">
                  A key for a one-off export should expire. One behind a live dashboard should not.
                </p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  <KeyRound className="size-4" />
                  {saving ? "Creating..." : "Create key"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Copy this key now</DialogTitle>
                <DialogDescription>
                  This is the only time it will be shown. If you lose it, revoke the key and make
                  another.
                </DialogDescription>
              </DialogHeader>
              <CopyField value={minted} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Send it as <code className="font-mono">Authorization: Bearer …</code> or{" "}
                <code className="font-mono">X-API-Key</code>. Start at{" "}
                <code className="font-mono">GET /api/v1</code> for the list of resources, and add{" "}
                <code className="font-mono">?format=csv</code> to any of them.
              </p>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setMinted(null);
                    setOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(next) => {
          if (!next) setRevoking(null);
        }}
        title={`Revoke "${revoking?.name ?? ""}"?`}
        description={
          <>
            Anything using this key stops working immediately. The key stays in the list, marked
            revoked, so there is a record of when it was withdrawn and by whom.
          </>
        }
        confirmLabel="Revoke key"
        destructive
        pending={isPending}
        onConfirm={() =>
          startTransition(async () => {
            if (revoking === null) return;
            const result = await revokeApiKey(revoking.id);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            setRevoking(null);
            toast.success("Key revoked.");
          })
        }
      />
    </>
  );
}
