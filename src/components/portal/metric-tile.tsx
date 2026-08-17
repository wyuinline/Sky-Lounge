import { cn } from "@/lib/utils";

const toneBar = {
  neutral: "bg-brand-lime",
  good: "bg-[var(--status-good)]",
  warning: "bg-[var(--status-warning)]",
  critical: "bg-[var(--status-critical)]",
};

export function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: keyof typeof toneBar;
}) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-card px-4 py-3.5 transition-colors hover:border-brand-teal/40">
      {/* accent rail — the tile's status read, echoing the brand's hard edges */}
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", toneBar[tone])} />
      <p className="text-[11px] font-semibold tracking-[0.06em] text-brand-teal uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-3xl leading-none font-semibold tracking-[-0.02em] tabular-nums",
          tone === "critical" ? "text-[var(--status-critical)]" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
