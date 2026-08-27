"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/portal/option-select";
import { AttentionFlag } from "@/components/portal/attention-flag";
import {
  dueVerdict,
  intervalSummary,
  sortPlanStatus,
  type PlanItemStatus,
} from "@/lib/inspection-plans";

const TONE: Record<"good" | "warning" | "critical", string> = {
  good: "text-muted-foreground",
  warning: "text-[var(--status-warning)]",
  critical: "text-[var(--status-critical)]",
};

const FILTERS = [
  { value: "attention", label: "Needs attention" },
  { value: "all", label: "Everything scheduled" },
  { value: "overdue", label: "Overdue only" },
];

/**
 * Every aircraft against every item on its plans.
 *
 * Defaults to what needs attention rather than the full list: a five-aircraft
 * fleet on a ten-item plan is fifty rows, and the two that matter today are
 * what someone opened the page to find.
 */
export function PlanStatusTable({ rows }: { rows: PlanItemStatus[] }) {
  const [filter, setFilter] = useState("attention");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return sortPlanStatus(rows).filter((row) => {
      const verdict = dueVerdict(row);
      if (filter === "overdue" && !verdict.overdue) return false;
      if (filter === "attention" && verdict.severity === "good") return false;

      if (term === "") return true;
      return (
        row.drone_id.toLowerCase().includes(term) ||
        row.item_name.toLowerCase().includes(term) ||
        row.plan_name.toLowerCase().includes(term)
      );
    });
  }, [rows, filter, search]);

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No inspection plans apply to the fleet yet. Create one and it will show every aircraft it
        covers, with each item&apos;s next due point derived from the work already recorded.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search aircraft, item or plan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <OptionSelect
          value={filter}
          onValueChange={setFilter}
          options={FILTERS}
          className="sm:w-56"
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {filter === "attention"
            ? "Nothing on any plan needs attention. Every item is comfortably inside its interval."
            : "Nothing matches that."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">Aircraft</th>
                <th className="px-4 py-2.5 font-medium">Item</th>
                <th className="px-4 py-2.5 font-medium">Interval</th>
                <th className="px-4 py-2.5 font-medium">Last done</th>
                <th className="px-4 py-2.5 font-medium">Next due</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const verdict = dueVerdict(row);
                return (
                  <tr
                    key={`${row.uav_id}-${row.item_id}`}
                    className="border-t border-border/60"
                  >
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{row.drone_id}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-2">
                        {row.item_name}
                        {row.is_critical ? <Badge variant="outline">Critical</Badge> : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">{row.plan_name}</span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {intervalSummary(row)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-muted-foreground">
                      {row.last_completed_on ?? "Never"}
                    </td>
                    <td className={`px-4 py-2.5 whitespace-nowrap ${TONE[verdict.severity]}`}>
                      <span className="flex items-center gap-1.5">
                        {verdict.severity !== "good" ? (
                          <AttentionFlag
                            flags={[
                              {
                                severity: verdict.overdue ? "overdue" : "attention",
                                label: `${row.item_name}: ${verdict.summary}`,
                              },
                            ]}
                          />
                        ) : null}
                        {verdict.summary}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
