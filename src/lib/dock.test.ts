import { describe, it, expect } from "vitest";
import { dockFalloff, dockTransform, DOCK_REST, MAX_SCALE, MAX_LIFT, REACH } from "@/lib/dock";

const TILE = 100;

describe("dockFalloff", () => {
  it("is at full strength directly under the cursor", () => {
    expect(dockFalloff(0, 135)).toBe(1);
  });

  it("decreases as the cursor moves away", () => {
    const near = dockFalloff(20, 135);
    const mid = dockFalloff(80, 135);
    const far = dockFalloff(200, 135);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it("is symmetric — direction does not matter, only distance", () => {
    expect(dockFalloff(40, 135)).toBeCloseTo(dockFalloff(40, 135), 10);
  });

  it("has effectively died out beyond the reach", () => {
    expect(dockFalloff(135 * 2, 135)).toBeLessThan(0.02);
  });

  it("never returns a negative or runaway value", () => {
    for (const d of [0, 1, 50, 500, 5000]) {
      const f = dockFalloff(d, 135);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it("is inert rather than dividing by zero before layout settles", () => {
    // Tiles measure 0 wide on the first frame after mount.
    expect(dockFalloff(50, 0)).toBe(0);
    expect(dockFalloff(0, 0)).toBe(0);
  });
});

describe("dockTransform", () => {
  it("peaks at the cursor and returns to rest far away", () => {
    const under = dockTransform(0, TILE);
    expect(under.scale).toBeCloseTo(1 + MAX_SCALE, 5);
    expect(under.lift).toBeCloseTo(MAX_LIFT, 5);
    expect(under.raised).toBe(true);

    const away = dockTransform(TILE * REACH * 3, TILE);
    expect(away.scale).toBeCloseTo(1, 2);
    expect(away.lift).toBeCloseTo(0, 1);
    expect(away.raised).toBe(false);
  });

  it("swells neighbours, which is what makes it a dock rather than a hover", () => {
    // One tile over: still visibly magnified, but less than the one under
    // the cursor.
    const neighbour = dockTransform(TILE, TILE);
    expect(neighbour.scale).toBeGreaterThan(1.02);
    expect(neighbour.scale).toBeLessThan(dockTransform(0, TILE).scale);
  });

  it("falls off monotonically across a whole row", () => {
    const scales = [0, 1, 2, 3, 4, 5].map((i) => dockTransform(i * TILE, TILE).scale);
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeLessThan(scales[i - 1]);
    }
  });

  it("never scales a tile down", () => {
    for (const d of [0, 10, 100, 1000]) {
      expect(dockTransform(d, TILE).scale).toBeGreaterThanOrEqual(1);
    }
  });

  it("rests flat when tiles have no measured width yet", () => {
    expect(dockTransform(0, 0)).toEqual(DOCK_REST);
  });
});
