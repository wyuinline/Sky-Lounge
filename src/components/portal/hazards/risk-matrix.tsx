"use client";

import { cn } from "@/lib/utils";
import {
  likelihoodOrder,
  severityOrder,
  likelihoodLabel,
  severityLabel,
  riskScore,
  riskBand,
  bandLabel,
  bandGuidance,
  type Likelihood,
  type RiskBand,
  type Severity,
} from "@/lib/risk";

/**
 * The 5x5 matrix, drawn as the grid an auditor expects to see.
 *
 * Colour is the band, not the raw score, so two cells that demand the same
 * response look the same even where their numbers differ. The counts overlaid
 * on each cell are what makes it a picture of this operation rather than a
 * diagram of the method.
 */
export const bandStyle: Record<RiskBand, string> = {
  low: "bg-[var(--status-good)]/15 text-[var(--status-good)] border-[var(--status-good)]/35",
  medium: "bg-[var(--status-warning)]/18 text-[var(--status-warning)] border-[var(--status-warning)]/40",
  high: "bg-[var(--status-serious)]/18 text-[var(--status-serious)] border-[var(--status-serious)]/45",
  extreme: "bg-[var(--status-critical)]/18 text-[var(--status-critical)] border-[var(--status-critical)]/50",
};

export type MatrixPoint = { likelihood: Likelihood; severity: Severity };

export function RiskMatrix({
  points = [],
  caption,
}: {
  /** One entry per hazard, so each cell can show how many sit in it. */
  points?: MatrixPoint[];
  caption?: string;
}) {
  const count = (l: Likelihood, s: Severity) =>
    points.filter((p) => p.likelihood === l && p.severity === s).length;

  // Likelihood ascends up the page, which is how these are always drawn.
  const rows = [...likelihoodOrder].reverse();

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          {caption ? (
            <caption className="pb-2 text-left text-xs text-muted-foreground">{caption}</caption>
          ) : null}
          <thead>
            <tr>
              <th className="w-28 px-2 py-1.5 text-left text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
                Likelihood
              </th>
              {severityOrder.map((s) => (
                <th
                  key={s}
                  scope="col"
                  className="px-2 py-1.5 text-center text-xs font-semibold tracking-[0.04em] text-brand-teal uppercase"
                >
                  {severityLabel[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l}>
                <th
                  scope="row"
                  className="px-2 py-1.5 text-left text-xs font-medium whitespace-nowrap"
                >
                  {likelihoodLabel[l]}
                </th>
                {severityOrder.map((s) => {
                  const score = riskScore(l, s);
                  const band = riskBand(score);
                  const n = count(l, s);
                  return (
                    <td key={s} className="p-1">
                      <div
                        title={`${likelihoodLabel[l]} × ${severityLabel[s]} = ${score} (${bandLabel[band]})`}
                        className={cn(
                          "flex h-14 flex-col items-center justify-center gap-0.5 rounded-md border",
                          bandStyle[band],
                        )}
                      >
                        <span className="text-xs font-semibold tabular-nums opacity-70">
                          {score}
                        </span>
                        {n > 0 ? (
                          <span className="text-sm font-bold tabular-nums">
                            {n}
                            <span className="sr-only">
                              {" "}
                              hazard{n === 1 ? "" : "s"} at {likelihoodLabel[l]} likelihood and{" "}
                              {severityLabel[s]} severity
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(["extreme", "high", "medium", "low"] as RiskBand[]).map((band) => (
          <div key={band} className="flex items-start gap-2">
            <dt
              className={cn(
                "shrink-0 rounded-sm border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase",
                bandStyle[band],
              )}
            >
              {bandLabel[band]}
            </dt>
            <dd className="text-xs text-muted-foreground">{bandGuidance[band]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
