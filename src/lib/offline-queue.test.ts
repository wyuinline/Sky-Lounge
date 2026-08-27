import { describe, it, expect } from "vitest";
import {
  shouldRetry,
  partitionQueue,
  describeQueue,
  toFormData,
  fromFormData,
  summariseQueued,
  NETWORK_ERROR,
  MAX_ATTEMPTS,
  type QueuedFlight,
} from "@/lib/offline-queue";

function item(over: Partial<QueuedFlight> = {}): QueuedFlight {
  return {
    id: "a",
    fields: [["flight_date", "2026-08-26"]],
    queuedAt: "2026-08-26T10:00:00.000Z",
    attempts: 0,
    lastError: null,
    ...over,
  };
}

describe("shouldRetry", () => {
  it("retries something that has never been tried", () => {
    expect(shouldRetry(item())).toBe(true);
  });

  it("retries a network failure — the flight is still good", () => {
    expect(shouldRetry(item({ attempts: 2, lastError: NETWORK_ERROR }))).toBe(true);
  });

  it("does not retry a flight the server refused", () => {
    // An unairworthy aircraft or an unauthorised pilot will be refused again
    // every time the signal returns; retrying would just spam the crew.
    expect(
      shouldRetry(item({ attempts: 1, lastError: "UAV-001 is grounded." })),
    ).toBe(false);
  });

  it("gives up after enough network failures", () => {
    expect(
      shouldRetry(item({ attempts: MAX_ATTEMPTS, lastError: NETWORK_ERROR })),
    ).toBe(false);
  });
});

describe("partitionQueue", () => {
  it("separates what can be sent from what cannot", () => {
    const { ready, blocked } = partitionQueue([
      item({ id: "ok" }),
      item({ id: "refused", attempts: 1, lastError: "Refused." }),
    ]);
    expect(ready.map((i) => i.id)).toEqual(["ok"]);
    expect(blocked.map((i) => i.id)).toEqual(["refused"]);
  });

  it("files oldest first, whatever order they arrived in", () => {
    // A crew filing three flights at the end of a day expects them in the
    // order they flew.
    const { ready } = partitionQueue([
      item({ id: "third", queuedAt: "2026-08-26T15:00:00.000Z" }),
      item({ id: "first", queuedAt: "2026-08-26T09:00:00.000Z" }),
      item({ id: "second", queuedAt: "2026-08-26T12:00:00.000Z" }),
    ]);
    expect(ready.map((i) => i.id)).toEqual(["first", "second", "third"]);
  });

  it("copes with an empty queue", () => {
    expect(partitionQueue([])).toEqual({ ready: [], blocked: [] });
  });
});

describe("describeQueue", () => {
  it("says nothing when there is nothing waiting", () => {
    expect(describeQueue([])).toBeNull();
  });

  it("counts what is waiting, in the singular where it should be", () => {
    expect(describeQueue([item()])).toBe("1 flight waiting to file");
    expect(describeQueue([item({ id: "a" }), item({ id: "b" })])).toBe(
      "2 flights waiting to file",
    );
  });

  it("reports rejections separately from waiting flights", () => {
    const out = describeQueue([
      item({ id: "ok" }),
      item({ id: "bad", attempts: 1, lastError: "Refused." }),
    ]);
    expect(out).toBe("1 waiting to file, 1 rejected");
  });

  it("leads with the failure when nothing can be sent", () => {
    expect(describeQueue([item({ attempts: 1, lastError: "Refused." })])).toBe(
      "1 flight could not be filed",
    );
  });
});

describe("form round trip", () => {
  it("survives capture and rebuild unchanged", () => {
    const original = new FormData();
    original.append("flight_date", "2026-08-26");
    original.append("duration_minutes", "45");
    original.append("battery_ids", "b1");
    original.append("battery_ids", "b2");

    const rebuilt = toFormData(item({ fields: fromFormData(original) }));
    expect(rebuilt.get("flight_date")).toBe("2026-08-26");
    // Repeated fields matter: batteries and observers are both multi-valued,
    // and collapsing them would lose every pack after the first.
    expect(rebuilt.getAll("battery_ids")).toEqual(["b1", "b2"]);
  });

  it("drops anything that is not text", () => {
    // Flight logs carry no files, and silently storing a File that cannot be
    // revived would produce a submission missing a field on retry.
    const withFile = new FormData();
    withFile.append("flight_date", "2026-08-26");
    withFile.append("file", new Blob(["x"]), "log.csv");
    expect(fromFormData(withFile)).toEqual([["flight_date", "2026-08-26"]]);
  });
});

describe("summariseQueued", () => {
  it("describes a flight the way the crew would", () => {
    expect(
      summariseQueued(
        item({
          fields: [
            ["flight_date", "2026-08-26"],
            ["location_name", "Acheson pit"],
            ["duration_minutes", "45"],
          ],
        }),
      ),
    ).toBe("2026-08-26 · Acheson pit · 45 min");
  });

  it("still says something useful with almost nothing filled in", () => {
    expect(summariseQueued(item({ fields: [] }))).toBe("Undated flight");
  });
});
