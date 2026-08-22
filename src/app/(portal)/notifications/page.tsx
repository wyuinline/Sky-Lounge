import { BellOff } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { StatusDot } from "@/components/portal/status-dot";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const severityTone = {
  critical: "critical",
  high: "warning",
  medium: "neutral",
  low: "good",
} as const;

function relativeDate(iso: string) {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function NotificationsPage() {
  const supabase = await createClient();

  // RLS returns only what targets this user's role or names them directly.
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, kind, severity, title, body, due_date, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = notifications ?? [];
  const outstanding = rows.filter((n) => n.severity === "critical").length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Compliance Alerts"
        title="Notifications"
        subtitle={
          outstanding > 0
            ? `${outstanding} item${outstanding === 1 ? "" : "s"} need attention now.`
            : "Expiring credentials, upcoming maintenance, and audit deadlines assigned to you."
        }
      />

      {rows.length === 0 ? (
        <Card className="rounded-md">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <BellOff className="size-6 text-muted-foreground" />
            <p className="font-medium">Nothing needs your attention</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Reminders appear here when a certificate or medical is approaching expiry,
              maintenance falls due, or an audit deadline is near. The check runs each morning.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <ul className="divide-y divide-border">
            {rows.map((n) => (
              <li key={n.id} className="flex items-start gap-3 bg-card px-4 py-3">
                <span className="mt-1.5">
                  <StatusDot tone={severityTone[n.severity]} label="" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{n.title}</p>
                  {n.body ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                  {relativeDate(n.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
