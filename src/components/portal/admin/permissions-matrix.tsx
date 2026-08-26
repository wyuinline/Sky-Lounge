"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accessAreaLabel,
  accessAreaOrder,
  accessLevelDescription,
  accessLevelLabel,
  levelsForArea,
  roleDescription,
  roleLabel,
  roleOrder,
  type AccessArea,
  type AccessLevel,
  type UserRole,
} from "@/lib/access";
import { setRolePermission } from "@/app/(portal)/admin/permissions/actions";

export type Matrix = Record<UserRole, Record<AccessArea, AccessLevel>>;

/** Each level gets its own weight and colour so a column reads at a glance. */
const levelStyle: Record<AccessLevel, string> = {
  full: "bg-[var(--status-good)]/12 text-[var(--status-good)] border-[var(--status-good)]/35 font-semibold",
  create: "bg-brand-teal/12 text-brand-teal border-brand-teal/35 font-medium",
  read: "bg-muted text-muted-foreground border-border",
  own: "bg-[var(--status-warning)]/15 text-[var(--status-warning)] border-[var(--status-warning)]/40 font-medium",
  none: "bg-transparent text-muted-foreground/45 border-dashed border-border",
};

const shortLabel: Record<AccessLevel, string> = {
  full: "Full",
  create: "Create",
  read: "Read",
  own: "Own",
  none: "—",
};

export function PermissionsMatrix({
  initial,
  editable,
  currentRole,
}: {
  initial: Matrix;
  /** False for anyone without full authority over user management. */
  editable: boolean;
  currentRole: UserRole;
}) {
  const [matrix, setMatrix] = useState(initial);
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ role: UserRole; area: AccessArea } | null>(null);

  function set(role: UserRole, area: AccessArea, level: AccessLevel) {
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [area]: level } }));
  }

  function change(role: UserRole, area: AccessArea, level: AccessLevel) {
    const previous = matrix[role][area];
    if (level === previous) return;

    // Paint the new level immediately; the server is the authority, so put the
    // old one back if it refuses rather than leaving the cell lying.
    const key = `${role}:${area}`;
    set(role, area, level);
    setPending(key);
    startTransition(async () => {
      const result = await setRolePermission(role, area, level);
      setPending(null);
      if (result.error) {
        set(role, area, previous);
        toast.error(result.error);
        return;
      }
      toast.success(
        `${roleLabel[role]} — ${accessAreaLabel[area]}: ${accessLevelLabel[level].toLowerCase()}`,
      );
    });
  }

  function cycle(role: UserRole, area: AccessArea, backwards: boolean) {
    const options = levelsForArea(area);
    const index = options.indexOf(matrix[role][area]);
    const next = options[(index + (backwards ? -1 : 1) + options.length) % options.length];
    change(role, area, next);
  }

  const active = hovered ? matrix[hovered.role][hovered.area] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase"
              >
                Area
              </th>
              {roleOrder.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="px-2 py-3 align-bottom"
                  title={roleDescription[role]}
                >
                  <span className="block text-xs font-semibold tracking-[-0.01em]">
                    {roleLabel[role]}
                  </span>
                  {role === currentRole ? (
                    <span className="mt-0.5 block text-[10px] font-normal text-brand-teal">
                      your role
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accessAreaOrder.map((area) => (
              <tr key={area} className="border-t border-border">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-background px-4 py-2 text-left text-sm font-medium whitespace-nowrap"
                >
                  {accessAreaLabel[area]}
                </th>
                {roleOrder.map((role) => {
                  const level = matrix[role][area];
                  const key = `${role}:${area}`;
                  return (
                    <td key={role} className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={!editable || pending === key}
                        onClick={(e) => cycle(role, area, e.shiftKey)}
                        onMouseEnter={() => setHovered({ role, area })}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered({ role, area })}
                        onBlur={() => setHovered(null)}
                        aria-label={`${roleLabel[role]}, ${accessAreaLabel[area]}: ${accessLevelLabel[level]}.${
                          editable ? " Click to change." : ""
                        }`}
                        className={cn(
                          "w-full rounded-md border px-2 py-1.5 text-xs",
                          "transition-[background-color,border-color,box-shadow,transform] duration-100 ease-out",
                          "outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                          levelStyle[level],
                          // 78 cells: a bezel on each would be noise, so the
                          // affordance is in the lift on hover instead.
                          editable &&
                            "cursor-pointer hover:-translate-y-px hover:brightness-[1.06] hover:shadow-[var(--control-lift)] active:translate-y-0 active:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                          !editable && "cursor-default",
                          pending === key && "opacity-50",
                        )}
                      >
                        {shortLabel[level]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <dl className="flex flex-wrap gap-x-5 gap-y-2">
          {(["full", "create", "read", "own", "none"] as AccessLevel[]).map((level) => (
            <div key={level} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("rounded-md border px-2 py-0.5 text-xs", levelStyle[level])}
              >
                {shortLabel[level]}
              </span>
              <dt className="sr-only">{accessLevelLabel[level]}</dt>
              <dd className="text-xs text-muted-foreground">{accessLevelLabel[level]}</dd>
            </div>
          ))}
        </dl>
        {editable ? (
          <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <RotateCcw className="size-3.5" />
            Click a cell to change it, shift-click to go back. Saves immediately.
          </p>
        ) : null}
      </div>

      <p className="min-h-[1.25rem] text-sm text-muted-foreground" aria-live="polite">
        {active ? accessLevelDescription[active] : null}
      </p>
    </div>
  );
}
