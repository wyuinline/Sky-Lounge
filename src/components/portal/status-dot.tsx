import { cn } from "@/lib/utils";

const toneColor = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
  neutral: "#a1d884",
  // For states that are an absence rather than a condition — a retired
  // airframe is not healthy, unhealthy, or anything in between.
  muted: "var(--muted-foreground)",
};

export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: keyof typeof toneColor;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: toneColor[tone], boxShadow: `0 0 0 3px ${toneColor[tone]}26` }}
      />
      <span className="capitalize">{label}</span>
    </span>
  );
}
