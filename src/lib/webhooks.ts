/**
 * Outbound webhooks.
 *
 * A push, where the read API is a pull. The two exist for different people:
 * a BI tool polls on its own schedule, but a safety officer wants a Teams
 * message the moment an incident is filed.
 *
 * Every delivery is signed. Without a signature the receiver has no way to
 * tell a genuine incident notification from anyone who guessed the URL, and a
 * URL is not a secret — it sits in a config file on someone else's server.
 *
 * The pure parts — envelope, signature, which hooks match — are here and
 * tested. Sending is a thin adapter beneath them.
 */

import type { Database } from "@/lib/database.types";

export type WebhookEvent = Database["public"]["Enums"]["webhook_event"];

export const webhookEvents: WebhookEvent[] = [
  "flight.logged",
  "flight_request.submitted",
  "flight_request.approved",
  "flight_request.rejected",
  "incident.reported",
  "maintenance.due",
  "maintenance.completed",
  "document.expiring",
  "certification.expiring",
];

export const webhookEventLabel: Record<WebhookEvent, string> = {
  "flight.logged": "A flight is logged",
  "flight_request.submitted": "A flight is requested",
  "flight_request.approved": "A flight request is approved",
  "flight_request.rejected": "A flight request is rejected",
  "incident.reported": "An incident is reported",
  "maintenance.due": "Maintenance falls due",
  "maintenance.completed": "Maintenance is completed",
  "document.expiring": "A document is nearing review",
  "certification.expiring": "A certificate is nearing expiry",
};

export type WebhookEnvelope = {
  event: WebhookEvent;
  /** Lets a receiver discard a replay, and match a retry to the original. */
  id: string;
  occurred_at: string;
  data: Record<string, unknown>;
};

export type WebhookTarget = {
  id: string;
  url: string;
  events: string[];
  signing_secret: string;
  active: boolean;
};

/** Which configured hooks want this event. */
export function targetsFor(hooks: WebhookTarget[], event: WebhookEvent): WebhookTarget[] {
  return hooks.filter((h) => h.active && h.events.includes(event));
}

export function buildEnvelope(
  event: WebhookEvent,
  data: Record<string, unknown>,
  now = new Date(),
): WebhookEnvelope {
  return { event, id: crypto.randomUUID(), occurred_at: now.toISOString(), data };
}

/**
 * Signs a payload, HMAC-SHA256, hex.
 *
 * The timestamp is signed alongside the body so a captured delivery cannot be
 * replayed a week later against a receiver that only checks the body.
 */
export async function signPayload(
  secret: string,
  body: string,
  timestamp: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generates a signing secret for a new hook. */
export function mintSigningSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Whether a response counts as delivered. */
export function isDelivered(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * The instructions a receiver needs, generated from the same code that signs.
 *
 * Written out in the UI next to the hook, so the person wiring up the other end
 * is not working from a document that drifted.
 */
export function verificationNotes(): string {
  return [
    "Each delivery carries two headers:",
    "  X-UAVOps-Timestamp — the ISO instant the delivery was signed",
    "  X-UAVOps-Signature — HMAC-SHA256, hex, of `<timestamp>.<raw body>`",
    "",
    "To verify: recompute the HMAC with your signing secret over the timestamp,",
    "a full stop, and the raw request body — before any JSON parsing — and",
    "compare in constant time. Reject anything older than five minutes.",
  ].join("\n");
}
