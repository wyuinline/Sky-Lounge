/**
 * Reading an inspection plan's status.
 *
 * The database derives how much is left on each of three clocks — hours,
 * cycles, calendar — and this decides what that means: which clock is nearest,
 * how to say so, and whether it is worth someone's attention today.
 *
 * The clocks are never converted into one another. An hour of flying is not a
 * day of sitting in a case, and an average between them would be a due date
 * nobody chose. So the nearest clock is chosen by *proportion of its own
 * interval remaining*, and reported in its own units.
 */

/** One aircraft against one plan item, as the view returns it. */
export type PlanItemStatus = {
  uav_id: string;
  drone_id: string;
  plan_name: string;
  item_id: string;
  item_name: string;
  is_critical: boolean;
  sort_order: number;
  interval_hours: number | null;
  interval_cycles: number | null;
  interval_months: number | null;
  hours_remaining: number | null;
  cycles_remaining: number | null;
  days_remaining: number | null;
  due_date: string | null;
  last_completed_on: string | null;
  current_hours: number;
  current_cycles: number;
  is_due: boolean;
};

export type Clock = "hours" | "cycles" | "calendar";

export type DueVerdict = {
  /** The clock that will run out first. Null when the item has no clock left. */
  clock: Clock | null;
  /** Remaining on that clock, in its own units. Negative when overdue. */
  remaining: number | null;
  overdue: boolean;
  /** How it reads in a table cell. */
  summary: string;
  severity: "good" | "warning" | "critical";
};

/** Warn this far out. Matches the portal's two-week attention window. */
export const WARN_DAYS = 14;
/** An hours clock warns with this much flying left — roughly a week's work. */
export const WARN_HOURS = 5;
export const WARN_CYCLES = 10;

/**
 * Which clock falls first.
 *
 * Compared as a fraction of each clock's own interval, because "10 hours left"
 * and "10 days left" are not comparable numbers but "8% of the interval left"
 * and "40% left" are.
 */
export function nearestClock(status: PlanItemStatus): Clock | null {
  const candidates: { clock: Clock; fraction: number }[] = [];

  if (status.hours_remaining !== null && status.interval_hours) {
    candidates.push({ clock: "hours", fraction: status.hours_remaining / status.interval_hours });
  }
  if (status.cycles_remaining !== null && status.interval_cycles) {
    candidates.push({
      clock: "cycles",
      fraction: status.cycles_remaining / status.interval_cycles,
    });
  }
  if (status.days_remaining !== null && status.interval_months) {
    // A month is taken as 30 days here purely to turn the interval into the
    // same unit as days_remaining; the figure reported is still real days.
    candidates.push({
      clock: "calendar",
      fraction: status.days_remaining / (status.interval_months * 30),
    });
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.fraction < a.fraction ? b : a)).clock;
}

function remainingOn(status: PlanItemStatus, clock: Clock): number | null {
  if (clock === "hours") return status.hours_remaining;
  if (clock === "cycles") return status.cycles_remaining;
  return status.days_remaining;
}

function warnThreshold(clock: Clock): number {
  if (clock === "hours") return WARN_HOURS;
  if (clock === "cycles") return WARN_CYCLES;
  return WARN_DAYS;
}

function unitLabel(clock: Clock, amount: number): string {
  const n = Math.abs(Math.round(amount));
  if (clock === "hours") return `${n} flight ${n === 1 ? "hour" : "hours"}`;
  if (clock === "cycles") return `${n} ${n === 1 ? "flight" : "flights"}`;
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/**
 * What to show against a plan item.
 *
 * A critical item that is overdue reads as critical; a non-critical one reads
 * as a warning however late it is, because grounding an aircraft over a
 * cosmetic check is how people learn to ignore the flags entirely.
 */
export function dueVerdict(status: PlanItemStatus): DueVerdict {
  const clock = nearestClock(status);

  if (clock === null) {
    return {
      clock: null,
      remaining: null,
      overdue: false,
      summary: "No interval set",
      severity: "good",
    };
  }

  const remaining = remainingOn(status, clock);
  if (remaining === null) {
    return { clock, remaining: null, overdue: false, summary: "Not tracked", severity: "good" };
  }

  const overdue = remaining <= 0;
  const summary = overdue
    ? `Overdue by ${unitLabel(clock, remaining)}`
    : `Due in ${unitLabel(clock, remaining)}`;

  const severity: DueVerdict["severity"] = overdue
    ? status.is_critical
      ? "critical"
      : "warning"
    : remaining <= warnThreshold(clock)
      ? "warning"
      : "good";

  return { clock, remaining, overdue, summary, severity };
}

/** How the plan itself describes an item's schedule. */
export function intervalSummary(item: {
  interval_hours: number | null;
  interval_cycles: number | null;
  interval_months: number | null;
}): string {
  const parts: string[] = [];
  if (item.interval_hours !== null) parts.push(`${item.interval_hours} h`);
  if (item.interval_cycles !== null) parts.push(`${item.interval_cycles} flights`);
  if (item.interval_months !== null) {
    parts.push(item.interval_months === 12 ? "1 year" : `${item.interval_months} months`);
  }

  if (parts.length === 0) return "No interval";
  // "or", not "and": whichever falls first is what the item means.
  return `Every ${parts.join(" or ")}`;
}

/**
 * Orders a plan's status rows the way a maintenance lead reads them.
 *
 * Overdue first, then what is closest to due, then the plan's own order — so
 * the top of the list is always what needs doing.
 */
export function sortPlanStatus(rows: PlanItemStatus[]): PlanItemStatus[] {
  const rank = (row: PlanItemStatus) => {
    const verdict = dueVerdict(row);
    if (verdict.severity === "critical") return 0;
    if (verdict.severity === "warning") return 1;
    return 2;
  };

  return [...rows].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (a.drone_id !== b.drone_id) return a.drone_id.localeCompare(b.drone_id);
    return a.sort_order - b.sort_order;
  });
}

/**
 * Whether an aircraft should be held on the ground.
 *
 * Only a critical item does this, and only once actually overdue. It is the
 * same judgement the airworthiness gate already makes about a grounded status,
 * expressed against a plan rather than a manual flag.
 */
export function groundingItems(rows: PlanItemStatus[]): PlanItemStatus[] {
  return rows.filter((row) => row.is_critical && dueVerdict(row).overdue);
}

/** One line per aircraft, for the fleet table. */
export function summariseForAircraft(rows: PlanItemStatus[]): {
  overdue: number;
  dueSoon: number;
  grounding: number;
} {
  let overdue = 0;
  let dueSoon = 0;

  for (const row of rows) {
    const verdict = dueVerdict(row);
    if (verdict.overdue) overdue++;
    else if (verdict.severity === "warning") dueSoon++;
  }

  return { overdue, dueSoon, grounding: groundingItems(rows).length };
}
