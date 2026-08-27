import { redirect } from "next/navigation";
import { Plug } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { MetricTile } from "@/components/portal/metric-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ApiKeysPanel,
  type ApiKeyRow,
} from "@/components/portal/admin/api-keys-panel";
import {
  WebhooksPanel,
  type WebhookRow,
  type DeliveryRow,
} from "@/components/portal/admin/webhooks-panel";
import {
  SharePointPanel,
  type MirrorRow,
} from "@/components/portal/admin/sharepoint-panel";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { describeApi } from "@/lib/api-resources";
import { sharePointStatus } from "@/lib/sharepoint-client";
import { todayIso } from "@/lib/compliance";

/** How much delivery history is worth putting on the page. */
const RECENT_DELIVERIES = 25;

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const access = await getAccess();

  if (!access) redirect("/login");
  // A key is a credential for the whole portal, so this sits with user
  // management rather than with the fleet.
  if (!access.canManage("users")) redirect("/");

  const [
    { data: keys },
    { data: hooks },
    { data: deliveries },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("api_keys")
      .select(
        "id, name, key_hint, scopes, created_at, last_used_at, expires_at, revoked_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("webhooks")
      .select("id, name, url, events, active, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("webhook_deliveries")
      .select(
        "id, webhook_id, event, status_code, error, attempted_at, duration_ms",
      )
      .order("attempted_at", { ascending: false })
      .limit(RECENT_DELIVERIES),
    supabase
      .from("documents")
      .select(
        "id, title, category, sharepoint_url, sharepoint_synced_at, sharepoint_error",
      )
      .order("created_at", { ascending: false }),
  ]);

  const keyRows = (keys ?? []) as ApiKeyRow[];
  const hookRows = (hooks ?? []) as WebhookRow[];
  const deliveryRows = (deliveries ?? []) as DeliveryRow[];

  const today = todayIso();
  const liveKeys = keyRows.filter(
    (k) =>
      k.revoked_at === null &&
      (k.expires_at === null || k.expires_at.slice(0, 10) > today),
  );
  const activeHooks = hookRows.filter((h) => h.active);
  const failedRecently = deliveryRows.filter((d) => d.error !== null);
  const api = describeApi();
  const sharePoint = sharePointStatus();
  const documentRows = (documents ?? []) as MirrorRow[];
  const mirrorFailures = documentRows.filter(
    (d) => d.sharepoint_error !== null,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Administration"
        title="Integrations"
        subtitle="Let other systems read the portal, and push events to them as they happen. Everything here is read-only — nothing outside the portal can file a record."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Live API keys" value={String(liveKeys.length)} />
        <MetricTile
          label="Active webhooks"
          value={String(activeHooks.length)}
        />
        <MetricTile
          label="Failed deliveries"
          value={String(failedRecently.length)}
          tone={failedRecently.length > 0 ? "warning" : "good"}
        />
        <MetricTile
          label="SharePoint mirror"
          value={
            sharePoint.configured
              ? mirrorFailures > 0
                ? "Failing"
                : "On"
              : "Off"
          }
          tone={
            !sharePoint.configured
              ? "neutral"
              : mirrorFailures > 0
                ? "warning"
                : "good"
          }
        />
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="sharepoint">SharePoint</TabsTrigger>
          <TabsTrigger value="reference">What the API serves</TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="size-4 text-brand-teal" />
                API keys
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ApiKeysPanel keys={keyRows} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
            </CardHeader>
            <CardContent>
              <WebhooksPanel hooks={hookRows} deliveries={deliveryRows} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sharepoint">
          <Card>
            <CardHeader>
              <CardTitle>SharePoint mirror</CardTitle>
            </CardHeader>
            <CardContent>
              <SharePointPanel
                configured={sharePoint.configured}
                missing={sharePoint.missing}
                documents={documentRows}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reference">
          <Card>
            <CardHeader>
              <CardTitle>What the API serves</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Generated from the API itself, so it cannot drift from what the
                endpoints actually do. Every resource takes{" "}
                <code className="font-mono text-xs">limit</code>,{" "}
                <code className="font-mono text-xs">offset</code> and{" "}
                <code className="font-mono text-xs">format=csv</code>.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium">Path</th>
                      <th className="pb-2 font-medium">Needs scope</th>
                      <th className="pb-2 font-medium">Returns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {api.resources.map((resource) => (
                      <tr
                        key={resource.name}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-2.5 pr-3 align-top font-mono text-xs">
                          {resource.path}
                        </td>
                        <td className="py-2.5 pr-3 align-top font-mono text-xs text-muted-foreground">
                          {resource.scope}
                        </td>
                        <td className="py-2.5 align-top text-muted-foreground">
                          {resource.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
