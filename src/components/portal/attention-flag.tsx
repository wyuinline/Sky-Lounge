import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { worstSeverity, type Flag as AttentionItem } from "@/lib/flags";

/**
 * The red marker beside a row that needs attention.
 *
 * Renders nothing at all when there is nothing wrong — an always-present icon
 * that merely changes colour is much harder to scan down a long table than one
 * that is simply absent most of the time.
 *
 * Reasons are carried in the tooltip and, for anyone not using a mouse, in the
 * accessible name, so the flag never means "something, somewhere".
 */
export function AttentionFlag({
  flags,
  className,
}: {
  flags: AttentionItem[];
  className?: string;
}) {
  const severity = worstSeverity(flags);
  if (severity === null) return null;

  const reasons = flags.map((f) => f.label);
  const summary = reasons.join(" · ");

  return (
    <span
      title={summary}
      className={cn("inline-flex items-center gap-1 align-middle", className)}
    >
      <Flag
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          severity === "overdue"
            ? "fill-[var(--status-critical)] text-[var(--status-critical)]"
            : "fill-[var(--status-serious)] text-[var(--status-serious)]",
        )}
      />
      {flags.length > 1 ? (
        <span
          aria-hidden
          className="text-xs font-semibold tabular-nums text-muted-foreground"
        >
          {flags.length}
        </span>
      ) : null}
      <span className="sr-only">
        {severity === "overdue" ? "Overdue: " : "Needs attention: "}
        {summary}
      </span>
    </span>
  );
}

/**
 * A one-line summary of everything flagged, for the top of a page.
 *
 * Deliberately reports zero as its own sentence rather than a "0" tile: the
 * useful thing to know is that nothing is outstanding, not that a counter is
 * empty.
 */
export function AttentionSummary({
  overdue,
  attention,
  noun,
}: {
  overdue: number;
  attention: number;
  noun: string;
}) {
  if (overdue === 0 && attention === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing needs attention in the {noun} right now.
      </p>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {overdue > 0 ? (
        <span className="flex items-center gap-1.5">
          <Flag
            aria-hidden
            className="size-4 fill-[var(--status-critical)] text-[var(--status-critical)]"
          />
          <span className="font-medium tabular-nums">{overdue}</span> overdue
        </span>
      ) : null}
      {attention > 0 ? (
        <span className="flex items-center gap-1.5">
          <Flag
            aria-hidden
            className="size-4 fill-[var(--status-serious)] text-[var(--status-serious)]"
          />
          <span className="font-medium tabular-nums">{attention}</span> due within two weeks
        </span>
      ) : null}
    </p>
  );
}
