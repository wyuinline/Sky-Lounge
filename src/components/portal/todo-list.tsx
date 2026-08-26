import Link from "next/link";
import { CheckCircle2, ChevronRight, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TodoItem } from "@/lib/todo";

/** How many to show before the list stops being a list and becomes a wall. */
const VISIBLE = 8;

/**
 * The dashboard to-do list.
 *
 * There is no "done" control, and that is deliberate: an item is here because
 * something is actually out of date or unfiled, so the only way to clear it is
 * to fix the thing. Each row links to the page where that happens, and the
 * item disappears on the next load. A tick you could press without doing the
 * work would make the list stop meaning anything within a week.
 */
export function TodoList({
  items,
  counts,
}: {
  items: TodoItem[];
  counts: { overdue: number; attention: number };
}) {
  const visible = items.slice(0, VISIBLE);
  const remaining = items.length - visible.length;

  return (
    <Card className="rounded-md">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-semibold tracking-[-0.01em]">
          Needs Attention
        </CardTitle>
        {items.length > 0 ? (
          <span className="flex items-center gap-3 text-xs">
            {counts.overdue > 0 ? (
              <span className="flex items-center gap-1.5">
                <Flag
                  aria-hidden
                  className="size-3.5 fill-[var(--status-critical)] text-[var(--status-critical)]"
                />
                <span className="font-semibold tabular-nums">{counts.overdue}</span>
                <span className="text-muted-foreground">overdue</span>
              </span>
            ) : null}
            {counts.attention > 0 ? (
              <span className="flex items-center gap-1.5">
                <Flag
                  aria-hidden
                  className="size-3.5 fill-[var(--status-serious)] text-[var(--status-serious)]"
                />
                <span className="font-semibold tabular-nums">{counts.attention}</span>
                <span className="text-muted-foreground">soon</span>
              </span>
            ) : null}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="size-6 text-[var(--status-good)]" />
            <p className="text-sm font-medium">Nothing needs attention</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Every certificate, service interval, and document review is current, and nothing is
              waiting on a decision.
            </p>
          </div>
        ) : (
          <>
            <ul className="flex flex-col">
              {visible.map((item) => (
                <li key={item.id} className="border-b border-border last:border-0">
                  <Link
                    href={item.href}
                    className="group flex items-start gap-3 py-2.5 transition-colors hover:bg-brand-mist/40"
                  >
                    <Flag
                      aria-hidden
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        item.severity === "overdue"
                          ? "fill-[var(--status-critical)] text-[var(--status-critical)]"
                          : "fill-[var(--status-serious)] text-[var(--status-serious)]",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.subject}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.reason}
                        <span aria-hidden> · </span>
                        <span className="text-brand-teal">{item.area}</span>
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
            {remaining > 0 ? (
              <p className="pt-3 text-xs text-muted-foreground">
                {remaining} more {remaining === 1 ? "item" : "items"} not shown — open the area
                pages to see the full list.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
