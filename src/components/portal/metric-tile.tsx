import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "critical";
}) {
  const toneBar = {
    neutral: "bg-[#a1d884]",
    good: "bg-[var(--status-good)]",
    warning: "bg-[var(--status-warning)]",
    critical: "bg-[var(--status-critical)]",
  }[tone];

  return (
    <div className="border-t-2 border-border bg-card px-4 py-3">
      <p className="font-heading text-[11px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-heading text-3xl leading-none font-bold tabular-nums text-foreground">
        {value}
      </p>
      <div className={cn("mt-3 h-[3px] w-full", toneBar)} />
    </div>
  );
}
