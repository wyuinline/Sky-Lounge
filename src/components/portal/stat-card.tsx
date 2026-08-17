import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "critical";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {Icon ? (
          <Icon
            className={cn(
              "size-4",
              tone === "critical" && "text-destructive",
              tone === "warning" && "text-[oklch(0.75_0.15_85)]",
              tone === "default" && "text-muted-foreground",
            )}
          />
        ) : null}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-semibold",
            tone === "critical" && "text-destructive",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
