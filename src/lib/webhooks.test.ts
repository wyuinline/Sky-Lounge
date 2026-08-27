import { describe, it, expect } from "vitest";
import {
  targetsFor,
  buildEnvelope,
  signPayload,
  mintSigningSecret,
  isDelivered,
  webhookEvents,
  webhookEventLabel,
  type WebhookTarget,
} from "@/lib/webhooks";

function hook(over: Partial<WebhookTarget> = {}): WebhookTarget {
  return {
    id: "h1",
    url: "https://example.test/hook",
    events: ["incident.reported"],
    signing_secret: "s3cret",
    active: true,
    ...over,
  };
}

describe("targetsFor", () => {
  it("picks only the hooks subscribed to the event", () => {
    const hooks = [
      hook({ id: "incidents" }),
      hook({ id: "flights", events: ["flight.logged"] }),
    ];
    expect(targetsFor(hooks, "incident.reported").map((h) => h.id)).toEqual(["incidents"]);
  });

  it("skips a hook that has been switched off", () => {
    // Deactivating is how someone silences a noisy integration without losing
    // its configuration; it has to actually stop deliveries.
    expect(targetsFor([hook({ active: false })], "incident.reported")).toEqual([]);
  });

  it("returns nothing rather than failing when no hook matches", () => {
    expect(targetsFor([hook()], "flight.logged")).toEqual([]);
  });
});

describe("buildEnvelope", () => {
  it("stamps the event, the time and a unique delivery id", () => {
    const at = new Date("2026-08-26T10:00:00.000Z");
    const envelope = buildEnvelope("flight.logged", { flight_id: "f1" }, at);
    expect(envelope.event).toBe("flight.logged");
    expect(envelope.occurred_at).toBe("2026-08-26T10:00:00.000Z");
    expect(envelope.data).toEqual({ flight_id: "f1" });
    expect(envelope.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("gives each delivery its own id, so a receiver can spot a replay", () => {
    const a = buildEnvelope("flight.logged", {});
    const b = buildEnvelope("flight.logged", {});
    expect(a.id).not.toBe(b.id);
  });
});

describe("signPayload", () => {
  const body = '{"event":"incident.reported"}';
  const ts = "2026-08-26T10:00:00.000Z";

  it("is stable for the same secret, body and timestamp", async () => {
    expect(await signPayload("s", body, ts)).toBe(await signPayload("s", body, ts));
  });

  it("changes when the body changes", async () => {
    expect(await signPayload("s", body, ts)).not.toBe(await signPayload("s", `${body} `, ts));
  });

  it("changes when the timestamp changes", async () => {
    // Otherwise a captured delivery could be replayed later unchanged.
    expect(await signPayload("s", body, ts)).not.toBe(
      await signPayload("s", body, "2026-08-27T10:00:00.000Z"),
    );
  });

  it("changes when the secret changes", async () => {
    expect(await signPayload("s", body, ts)).not.toBe(await signPayload("t", body, ts));
  });

  it("produces hex of the right length for SHA-256", async () => {
    expect(await signPayload("s", body, ts)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("mintSigningSecret", () => {
  it("is long and never repeats", () => {
    const a = mintSigningSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(mintSigningSecret());
  });
});

describe("isDelivered", () => {
  it("accepts the 2xx range and nothing else", () => {
    expect(isDelivered(200)).toBe(true);
    expect(isDelivered(204)).toBe(true);
    // A 302 is a receiver telling us the URL moved, not an accepted delivery.
    expect(isDelivered(302)).toBe(false);
    expect(isDelivered(404)).toBe(false);
    expect(isDelivered(500)).toBe(false);
  });
});

describe("event catalogue", () => {
  it("labels every event it offers", () => {
    for (const event of webhookEvents) {
      expect(webhookEventLabel[event]).toBeTruthy();
    }
  });
});
