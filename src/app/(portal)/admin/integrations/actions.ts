"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { mintKey, apiScopes, type ApiScope } from "@/lib/api-keys";
import { mintSigningSecret, webhookEvents, type WebhookEvent } from "@/lib/webhooks";
import { dispatchWebhook } from "@/lib/webhook-dispatch";

/**
 * Minting an API key.
 *
 * The secret is returned to the caller and never written down. Whoever creates
 * the key gets exactly one chance to copy it — which is the point: a key that
 * can be read back out of the portal is a key that a stolen admin session can
 * read back out of the portal.
 */
export async function createApiKey(formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in.", secret: null };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to create API keys.", secret: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the key a name, so it can be recognised later.", secret: null };

  const scopes = formData
    .getAll("scopes")
    .map(String)
    .filter((s): s is ApiScope => (apiScopes as string[]).includes(s));
  if (scopes.length === 0) {
    return { error: "Choose at least one thing this key may read.", secret: null };
  }

  const expiresRaw = String(formData.get("expires_at") ?? "").trim();
  if (expiresRaw && Number.isNaN(Date.parse(expiresRaw))) {
    return { error: "That expiry date is not valid.", secret: null };
  }

  const key = await mintKey();
  const supabase = await createClient();

  const { error } = await supabase.from("api_keys").insert({
    name,
    key_hash: key.hash,
    key_hint: key.hint,
    scopes,
    created_by: access.userId,
    expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
  });

  if (error) return { error: safeErrorMessage(error, "API key"), secret: null };

  revalidatePath("/admin/integrations");
  return { error: null, secret: key.secret };
}

/**
 * Revoking a key.
 *
 * The row is kept rather than deleted. "This key was revoked on the 3rd by
 * Sam" is the answer an auditor wants; a missing row answers nothing.
 */
export async function revokeApiKey(id: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to revoke API keys." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_by: access.userId })
    .eq("id", id)
    .is("revoked_at", null);

  if (error) return { error: safeErrorMessage(error, "API key") };

  revalidatePath("/admin/integrations");
  return { error: null };
}

export async function createWebhook(formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in.", secret: null };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to add webhooks.", secret: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!name) return { error: "Give the webhook a name.", secret: null };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "That is not a valid URL.", secret: null };
  }
  if (parsed.protocol !== "https:") {
    return { error: "Deliveries carry operational data, so the URL must be https.", secret: null };
  }

  const events = formData
    .getAll("events")
    .map(String)
    .filter((e): e is WebhookEvent => (webhookEvents as string[]).includes(e));
  if (events.length === 0) {
    return { error: "Choose at least one event to send.", secret: null };
  }

  const signingSecret = mintSigningSecret();
  const supabase = await createClient();

  const { error } = await supabase.from("webhooks").insert({
    name,
    url: parsed.toString(),
    events,
    signing_secret: signingSecret,
    created_by: access.userId,
  });

  if (error) return { error: safeErrorMessage(error, "webhook"), secret: null };

  revalidatePath("/admin/integrations");
  return { error: null, secret: signingSecret };
}

export async function setWebhookActive(id: string, active: boolean) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to change webhooks." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("webhooks").update({ active }).eq("id", id);
  if (error) return { error: safeErrorMessage(error, "webhook") };

  revalidatePath("/admin/integrations");
  return { error: null };
}

export async function deleteWebhook(id: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to remove webhooks." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("webhooks").delete().eq("id", id);
  if (error) return { error: safeErrorMessage(error, "webhook") };

  revalidatePath("/admin/integrations");
  return { error: null };
}

/**
 * Sends a test delivery.
 *
 * Awaited rather than fired through `notify`, because the entire point is to
 * tell the person here and now whether the other end answered.
 */
export async function testWebhook(id: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to test webhooks." };
  }

  const supabase = await createClient();
  const { data: hook } = await supabase
    .from("webhooks")
    .select("id, name, active, events")
    .eq("id", id)
    .maybeSingle();

  if (!hook) return { error: "That webhook no longer exists." };
  if (!hook.active) return { error: "Switch the webhook on before testing it." };

  // Sent as an event the hook is actually subscribed to, so the test exercises
  // the same path a real delivery takes. The payload says plainly that it is a
  // test, so nobody at the far end acts on it.
  const event = (hook.events[0] ?? "flight.logged") as WebhookEvent;
  const result = await dispatchWebhook(
    event,
    {
      test: true,
      note: "Test delivery from the UAV Operations Portal. Nothing was recorded.",
      webhook: hook.name,
    },
    hook.id,
  );

  revalidatePath("/admin/integrations");
  if (result.delivered === 0) {
    return { error: "The receiver did not accept the delivery. The log below says why." };
  }
  return { error: null };
}
