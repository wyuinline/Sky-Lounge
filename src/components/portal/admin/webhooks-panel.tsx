"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plus, Send, Trash2, Power } from "lucide-react";
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
import {
  webhookEvents,
  webhookEventLabel,
  verificationNotes,
  type WebhookEvent,
} from "@/lib/webhooks";
import {
  createWebhook,
  setWebhookActive,
  deleteWebhook,
  testWebhook,
} from "@/app/(portal)/admin/integrations/actions";

export type WebhookRow = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
};

export type DeliveryRow = {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  error: string | null;
  attempted_at: string;
  duration_ms: number | null;
};

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
            toast.info("Select the text and copy it manually.");
          }
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

/** The last attempt against a hook, said the way someone would ask about it. */
function DeliveryStatus({ delivery }: { delivery: DeliveryRow | undefined }) {
  if (delivery === undefined) {
    return <span className="text-xs text-muted-foreground">Nothing sent yet</span>;
  }

  const when = delivery.attempted_at.slice(0, 16).replace("T", " ");
  const ok = delivery.status_code !== null && delivery.status_code >= 200 && delivery.status_code < 300;

  return (
    <span className="flex flex-col gap-0.5 text-xs">
      <span className={ok ? "text-[var(--status-good)]" : "text-[var(--status-critical)]"}>
        {ok ? `Delivered — ${delivery.status_code}` : (delivery.error ?? "Failed")}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {when}
        {delivery.duration_ms !== null ? ` · ${delivery.duration_ms} ms` : ""}
      </span>
    </span>
  );
}

export function WebhooksPanel({
  hooks,
  deliveries,
}: {
  hooks: WebhookRow[];
  deliveries: DeliveryRow[];
}) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<WebhookRow | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Deliveries arrive newest first, so the first match per hook is the latest.
  const latest = new Map<string, DeliveryRow>();
  for (const delivery of deliveries) {
    if (!latest.has(delivery.webhook_id)) latest.set(delivery.webhook_id, delivery);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">
            A webhook pushes an event to another system the moment it happens — a Teams channel, a
            client&apos;s dashboard, a scheduling tool. Every delivery is signed.
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New webhook
          </Button>
        </div>

        {hooks.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No webhooks yet. Add one to push incidents or flight approvals somewhere else.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {hooks.map((hook) => (
              <li
                key={hook.id}
                className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{hook.name}</span>
                    <Badge variant={hook.active ? "secondary" : "outline"}>
                      {hook.active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <code className="max-w-full overflow-x-auto font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {hook.url}
                  </code>
                  <span className="flex flex-wrap gap-1">
                    {hook.events.map((event) => (
                      <Badge key={event} variant="outline">
                        {webhookEventLabel[event as WebhookEvent] ?? event}
                      </Badge>
                    ))}
                  </span>
                  <DeliveryStatus delivery={latest.get(hook.id)} />
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={testing === hook.id || !hook.active}
                    onClick={() =>
                      startTransition(async () => {
                        setTesting(hook.id);
                        const result = await testWebhook(hook.id);
                        setTesting(null);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Test delivered.");
                      })
                    }
                  >
                    <Send className="size-3.5" />
                    {testing === hook.id ? "Sending..." : "Test"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await setWebhookActive(hook.id, !hook.active);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success(hook.active ? "Webhook paused." : "Webhook active.");
                      })
                    }
                  >
                    <Power className="size-3.5" />
                    {hook.active ? "Pause" : "Resume"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(hook)}>
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {deliveries.length > 0 ? (
          <details className="rounded-md border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Recent deliveries ({deliveries.length})
            </summary>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Event</th>
                    <th className="px-4 py-2 font-medium">Result</th>
                    <th className="px-4 py-2 font-medium">Took</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">
                        {delivery.attempted_at.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{delivery.event}</td>
                      <td className="px-4 py-2">
                        {delivery.error === null ? (
                          <span className="text-[var(--status-good)]">{delivery.status_code}</span>
                        ) : (
                          <span className="text-[var(--status-critical)]">{delivery.error}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">
                        {delivery.duration_ms === null ? "—" : `${delivery.duration_ms} ms`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSecret(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {secret === null ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                const result = await createWebhook(new FormData(event.currentTarget));
                setSaving(false);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                setSecret(result.secret);
              }}
              className="flex flex-col gap-4"
            >
              <DialogHeader>
                <DialogTitle>New webhook</DialogTitle>
                <DialogDescription>
                  The portal will POST a signed JSON body to this URL whenever one of the events you
                  choose happens.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                <Label htmlFor="hook_name">Name</Label>
                <Input id="hook_name" name="name" placeholder="Safety channel — Teams" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="hook_url">URL</Label>
                <Input
                  id="hook_url"
                  name="url"
                  type="url"
                  placeholder="https://example.com/hooks/uav"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Must be https — deliveries carry operational data.
                </p>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Send when</legend>
                <div className="flex flex-col gap-2">
                  {webhookEvents.map((event) => (
                    <label key={event} className="flex items-center gap-2 text-sm">
                      <Checkbox name="events" value={event} />
                      {webhookEventLabel[event]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Adding..." : "Add webhook"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Signing secret</DialogTitle>
                <DialogDescription>
                  Give this to whoever runs the receiving end. It is how they prove a delivery came
                  from this portal and not from someone who guessed the URL.
                </DialogDescription>
              </DialogHeader>
              <CopyField value={secret} />
              <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs leading-relaxed">
                {verificationNotes()}
              </pre>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setSecret(null);
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
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        title={`Remove "${deleting?.name ?? ""}"?`}
        description={
          <>
            The webhook and its delivery history are deleted. To stop deliveries without losing the
            record, pause it instead.
          </>
        }
        confirmLabel="Remove webhook"
        destructive
        pending={isPending}
        onConfirm={() =>
          startTransition(async () => {
            if (deleting === null) return;
            const result = await deleteWebhook(deleting.id);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            setDeleting(null);
            toast.success("Webhook removed.");
          })
        }
      />
    </>
  );
}
