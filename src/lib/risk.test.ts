import { describe, it, expect } from "vitest";
import {
  likelihoodScore,
  severityScore,
  riskScore,
  riskBand,
  bandOf,
  mitigationEffect,
  likelihoodOrder,
  severityOrder,
  type Likelihood,
  type Severity,
} from "@/lib/risk";

describe("ordinals", () => {
  it("scores likelihood one to five in order", () => {
    expect(likelihoodOrder.map(likelihoodScore)).toEqual([1, 2, 3, 4, 5]);
  });

  it("scores severity one to five in order", () => {
    expect(severityOrder.map(severityScore)).toEqual([1, 2, 3, 4, 5]);
  });

  it("matches the ordinals the database uses", () => {
    // These are duplicated as SQL functions so a report scores a hazard the
    // same way the page does. If either side moves, this is the tripwire.
    expect(likelihoodScore("rare")).toBe(1);
    expect(likelihoodScore("almost_certain")).toBe(5);
    expect(severityScore("negligible")).toBe(1);
    expect(severityScore("catastrophic")).toBe(5);
  });
});

describe("riskScore", () => {
  it("multiplies likelihood by severity", () => {
    expect(riskScore("possible", "moderate")).toBe(9);
    expect(riskScore("rare", "negligible")).toBe(1);
    expect(riskScore("almost_certain", "catastrophic")).toBe(25);
  });

  it("covers the whole matrix without a gap or an overflow", () => {
    const scores: number[] = [];
    for (const l of likelihoodOrder) for (const s of severityOrder) scores.push(riskScore(l, s));
    expect(Math.min(...scores)).toBe(1);
    expect(Math.max(...scores)).toBe(25);
    expect(scores).toHaveLength(25);
  });
});

describe("riskBand", () => {
  it("bands at the documented thresholds", () => {
    expect(riskBand(1)).toBe("low");
    expect(riskBand(3)).toBe("low");
    expect(riskBand(4)).toBe("medium");
    expect(riskBand(8)).toBe("medium");
    expect(riskBand(9)).toBe("high");
    expect(riskBand(14)).toBe("high");
    expect(riskBand(15)).toBe("extreme");
    expect(riskBand(25)).toBe("extreme");
  });

  it("puts a likely major event in the extreme band", () => {
    // 4 x 4 = 16. This is the case the threshold was chosen around: the point
    // at which an operation should stop rather than be watched.
    expect(bandOf("likely", "major")).toBe("extreme");
  });

  it("does not treat a rare catastrophe as routine", () => {
    // 1 x 5 = 5. Medium, not low — rare is not the same as impossible.
    expect(bandOf("rare", "catastrophic")).toBe("medium");
  });

  it("does not treat a certain triviality as an emergency", () => {
    // 5 x 1 = 5.
    expect(bandOf("almost_certain", "negligible")).toBe("medium");
  });

  it("bands every cell of the matrix as one of the four", () => {
    for (const l of likelihoodOrder) {
      for (const s of severityOrder) {
        expect(["low", "medium", "high", "extreme"]).toContain(bandOf(l, s));
      }
    }
  });
});

describe("mitigationEffect", () => {
  it("reports how far the controls moved the risk", () => {
    expect(mitigationEffect(16, 6)).toEqual({ direction: "reduced", delta: 10 });
  });

  it("says nothing when residual risk has not been assessed", () => {
    // A blank must not read as "the mitigation achieved nothing".
    expect(mitigationEffect(16, null)).toBeNull();
  });

  it("reports an unchanged score honestly", () => {
    expect(mitigationEffect(9, 9)).toEqual({ direction: "unchanged", delta: 0 });
  });

  it("reports an increase rather than hiding it", () => {
    // Rare, but a control can introduce its own hazard, and a register that
    // cannot say so is not doing its job.
    expect(mitigationEffect(6, 12)).toEqual({ direction: "increased", delta: 6 });
  });
});

describe("matrix consistency", () => {
  it("never scores a worse cell lower than a milder one", () => {
    // Monotonic in both directions: increasing likelihood or severity can
    // never reduce the score.
    for (let li = 0; li < likelihoodOrder.length; li++) {
      for (let si = 0; si < severityOrder.length; si++) {
        const here = riskScore(likelihoodOrder[li] as Likelihood, severityOrder[si] as Severity);
        if (li + 1 < likelihoodOrder.length) {
          expect(
            riskScore(likelihoodOrder[li + 1] as Likelihood, severityOrder[si] as Severity),
          ).toBeGreaterThanOrEqual(here);
        }
        if (si + 1 < severityOrder.length) {
          expect(
            riskScore(likelihoodOrder[li] as Likelihood, severityOrder[si + 1] as Severity),
          ).toBeGreaterThanOrEqual(here);
        }
      }
    }
  });
});
