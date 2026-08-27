/**
 * Sending webhook deliveries.
 *
 * Separated from webhooks.ts so the pure half stays importable from client
 * components (the settings UI needs the event labels) while this half, which
 * needs the service role, never is.
 *
 * Delivery is best-effort by design. A receiver that is down must not stop a
 * pilot filing a flight — so failures are recorded and shown in the portal
 * rather than raised at the person who happened to trigger the event.
 */

import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import {
  buildEnvelope,
  signPayload,
  targetsFor,
  isDelivered,
  type WebhookEvent,
  type WebhookTarget,
} from "@/lib/webhooks";

/** A receiver that hangs must not hold a serverless function open. */
const TIMEOUT_MS = 8000;

/**
 * Delivers an event to every hook subscribed to it.
 *
 * Call this inside `after()` from a server action, so the person who triggered
 * the event has their response before any of this runs.
 */
export async function dispatchWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>,
  // The operator whose event this is. Required, because this runs on the
  // service role: without it an incident at one operator would be pushed to
  // every other operator's Teams channel.
  organisationId: string,
  // Set when testing one hook: a test must not fan out to every other
  // integration subscribed to the same event.
  onlyWebhookId?: string,
): Promise<{ delivered: number; failed: number }> {
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    // No service key configured — webhooks are simply off on this deployment.
    return { delivered: 0, failed: 0 };
  }

  let query = supabase
    .from("webhooks")
    .select("id, url, events, signing_secret, active")
    .eq("organisation_id", organisationId)
    .eq("active", true);
  if (onlyWebhookId) query = query.eq("id", onlyWebhookId);

  const { data: hooks, error } = await query;
  if (error || !hooks) return { delivered: 0, failed: 0 };

  const targets = targetsFor(hooks as WebhookTarget[], event);
  if (targets.length === 0) return { delivered: 0, failed: 0 };

  const envelope = buildEnvelope(event, data);
  const body = JSON.stringify(envelope);

  // In parallel: one slow receiver should not delay the others.
  const outcomes = await Promise.all(
    targets.map(async (target) => {
      const startedAt = Date.now();
      const timestamp = envelope.occurred_at;
      let statusCode: number | null = null;
      let failure: string | null = null;

      try {
        const signature = await signPayload(target.signing_secret, body, timestamp);
        const response = await fetch(target.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "UAVOpsPortal/1.0",
            "X-UAVOps-Event": event,
            "X-UAVOps-Delivery": envelope.id,
            "X-UAVOps-Timestamp": timestamp,
            "X-UAVOps-Signature": signature,
          },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        statusCode = response.status;
        if (!isDelivered(response.status)) {
          // The first line of the body is usually the receiver's own error.
          failure = (await response.text().catch(() => "")).slice(0, 500) || response.statusText;
        }
      } catch (cause) {
        failure = cause instanceof Error ? cause.message : "Delivery failed.";
      }

      await supabase
        .from("webhook_deliveries")
        .insert({
          webhook_id: target.id,
          // Set explicitly: the column's default reads the caller's
          // organisation, and a background task has no caller.
          organisation_id: organisationId,
          event,
          // Stored as sent, so a delivery log answers "what did they receive".
          payload: JSON.parse(body) as Json,
          status_code: statusCode,
          error: failure,
          attempted_at: new Date(startedAt).toISOString(),
          duration_ms: Date.now() - startedAt,
        })
        // A failed log write must not throw out of a background task.
        .then(undefined, () => undefined);

      return failure === null;
    }),
  );

  return {
    delivered: outcomes.filter(Boolean).length,
    failed: outcomes.filter((ok) => !ok).length,
  };
}

/**
 * Fires an event without making anyone wait for it.
 *
 * `after` runs the callback once the response has been sent, so a slow or
 * broken receiver costs the pilot filing the flight nothing. Errors are
 * swallowed here for the same reason — the delivery log is where a failed push
 * is reported, not the form the person was using.
 */
export function notify(
  event: WebhookEvent,
  data: Record<string, unknown>,
  organisationId: string,
): void {
  after(async () => {
    try {
      await dispatchWebhook(event, data, organisationId);
    } catch (cause) {
      console.error(`[webhooks] ${event} dispatch failed`, cause);
    }
  });
}
