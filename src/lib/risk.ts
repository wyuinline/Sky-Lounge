/**
 * Risk scoring for the hazard register.
 *
 * Likelihood times severity on a 5x5 matrix — the form every aviation safety
 * management system uses, so an auditor recognises it without explanation.
 *
 * The same ordinals exist as SQL functions, so a report written in SQL scores
 * a hazard identically. They are duplicated deliberately rather than the page
 * reading the view's score: the matrix has to be rendered cell by cell here,
 * which needs the maths client-side anyway, and a wrong band is loud rather
 * than silent — a hazard would appear in the wrong colour immediately.
 */

export type Likelihood = "rare" | "unlikely" | "possible" | "likely" | "almost_certain";
export type Severity = "negligible" | "minor" | "moderate" | "major" | "catastrophic";
export type RiskBand = "low" | "medium" | "high" | "extreme";

export const likelihoodOrder: Likelihood[] = [
  "rare",
  "unlikely",
  "possible",
  "likely",
  "almost_certain",
];

export const severityOrder: Severity[] = [
  "negligible",
  "minor",
  "moderate",
  "major",
  "catastrophic",
];

export const likelihoodLabel: Record<Likelihood, string> = {
  rare: "Rare",
  unlikely: "Unlikely",
  possible: "Possible",
  likely: "Likely",
  almost_certain: "Almost certain",
};

export const severityLabel: Record<Severity, string> = {
  negligible: "Negligible",
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  catastrophic: "Catastrophic",
};

/** What each level means in practice, so two people score the same hazard alike. */
export const likelihoodDescription: Record<Likelihood, string> = {
  rare: "Would need an exceptional combination of circumstances.",
  unlikely: "Could happen, but has not in this operation.",
  possible: "Has happened somewhere in the industry.",
  likely: "Has happened here, or should be expected within a year.",
  almost_certain: "Expected to happen repeatedly unless something changes.",
};

export const severityDescription: Record<Severity, string> = {
  negligible: "No injury, no damage, no operational effect.",
  minor: "Minor damage, or a flight abandoned.",
  moderate: "Aircraft damage, or a reportable occurrence.",
  major: "Serious injury, aircraft loss, or regulatory action.",
  catastrophic: "Fatality, or loss of the operating certificate.",
};

export const bandLabel: Record<RiskBand, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  extreme: "Extreme",
};

export function likelihoodScore(value: Likelihood): number {
  return likelihoodOrder.indexOf(value) + 1;
}

export function severityScore(value: Severity): number {
  return severityOrder.indexOf(value) + 1;
}

/** Combined score, 1 to 25. */
export function riskScore(likelihood: Likelihood, severity: Severity): number {
  return likelihoodScore(likelihood) * severityScore(severity);
}

/**
 * The band a score falls in.
 *
 * Banded by score alone rather than by matrix position, so the thresholds are
 * one number a safety officer can argue with rather than twenty-five cells to
 * audit. Extreme starts at 15, which is where a "likely major" sits — the
 * point at which an operation should stop rather than be watched.
 */
export function riskBand(score: number): RiskBand {
  if (score >= 15) return "extreme";
  if (score >= 9) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function bandOf(likelihood: Likelihood, severity: Severity): RiskBand {
  return riskBand(riskScore(likelihood, severity));
}

/** What the band demands, in the words an SMS uses. */
export const bandGuidance: Record<RiskBand, string> = {
  low: "Acceptable. Review at the normal interval.",
  medium: "Acceptable with controls in place and recorded.",
  high: "Controls required before the operation proceeds.",
  extreme: "Not acceptable. The operation stops until the risk is reduced.",
};

/**
 * How far the controls moved the risk, as a plain sentence.
 *
 * Returns null when residual risk has not been assessed — the register should
 * say "not yet assessed" rather than imply the mitigation achieved nothing.
 */
export function mitigationEffect(
  initial: number,
  residual: number | null,
): { direction: "reduced" | "unchanged" | "increased"; delta: number } | null {
  if (residual === null) return null;
  const delta = initial - residual;
  if (delta > 0) return { direction: "reduced", delta };
  if (delta < 0) return { direction: "increased", delta: Math.abs(delta) };
  return { direction: "unchanged", delta: 0 };
}
