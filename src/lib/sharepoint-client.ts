/**
 * Microsoft Graph calls for the SharePoint mirror.
 *
 * App-only authentication with the client credentials flow, so the mirror runs
 * without anyone signed in — a document uploaded at 6am by a crew lead lands in
 * SharePoint whether or not an administrator is at a desk.
 *
 * The Azure app registration needs `Sites.Selected` application permission and
 * a grant on the target site, which is narrower than `Files.ReadWrite.All`: it
 * gives the portal write access to one library rather than to every file in
 * the tenant.
 */

import "server-only";
import {
  readGraphConfig,
  mirrorPath,
  uploadRoute,
  planChunks,
  tokenIsFresh,
  tokenExpiry,
  isMirrorable,
  type GraphConfig,
} from "@/lib/sharepoint";
import type { Database } from "@/lib/database.types";

type DocumentCategory = Database["public"]["Enums"]["document_category"];

const GRAPH = "https://graph.microsoft.com/v1.0";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Cached per server instance.
 *
 * Graph issues app-only tokens with an hour's life, and a serverless instance
 * that mirrors three documents in a row should not fetch three tokens. The
 * cache is deliberately in-memory: a token in a database is a token to protect.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

export type MirrorResult =
  | { ok: true; webUrl: string; path: string }
  | { ok: false; reason: string; configured: boolean };

/** Whether the deployment is set up to mirror at all. */
export function sharePointStatus(): { configured: boolean; missing: string[] } {
  const config = readGraphConfig(process.env);
  return config.ok
    ? { configured: true, missing: [] }
    : { configured: false, missing: config.missing };
}

async function getAccessToken(config: GraphConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenIsFresh(cachedToken.expiresAt, now)) {
    return cachedToken.value;
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    // Azure's error body names the actual problem — a wrong secret, an expired
    // one, a tenant mismatch — and none of it is a credential.
    const detail = await response.text().catch(() => "");
    throw new Error(`Azure refused the client credentials: ${detail.slice(0, 300)}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: body.access_token,
    expiresAt: tokenExpiry(body.expires_in, now),
  };
  return cachedToken.value;
}

/** Graph addresses a file by path; the path must be encoded segment by segment. */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

type DriveItem = { id: string; webUrl: string };

async function simpleUpload(
  config: GraphConfig,
  token: string,
  path: string,
  file: Blob,
): Promise<DriveItem> {
  const response = await fetch(
    `${GRAPH}/sites/${config.siteId}/drives/${config.driveId}/root:/${encodePath(path)}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`Graph rejected the upload (${response.status}): ${(await response.text().catch(() => "")).slice(0, 300)}`);
  }
  return (await response.json()) as DriveItem;
}

async function sessionUpload(
  config: GraphConfig,
  token: string,
  path: string,
  file: Blob,
): Promise<DriveItem> {
  const createResponse = await fetch(
    `${GRAPH}/sites/${config.siteId}/drives/${config.driveId}/root:/${encodePath(path)}:/createUploadSession`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // Replacing rather than renaming: the portal's path already carries the
      // version, so a second upload of the same version is a correction.
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!createResponse.ok) {
    throw new Error(`Graph would not open an upload session (${createResponse.status}).`);
  }

  const { uploadUrl } = (await createResponse.json()) as { uploadUrl: string };
  const buffer = await file.arrayBuffer();
  let last: Response | null = null;

  // Sequential by necessity: Graph requires chunks in order on one session.
  for (const chunk of planChunks(buffer.byteLength)) {
    last = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.end - chunk.start + 1),
        "Content-Range": chunk.contentRange,
      },
      body: buffer.slice(chunk.start, chunk.end + 1),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!last.ok && last.status !== 202) {
      // 202 means "chunk accepted, send the next"; anything else is a failure.
      throw new Error(`Chunk ${chunk.contentRange} was refused (${last.status}).`);
    }
  }

  if (last === null) throw new Error("There was nothing to upload.");
  return (await last.json()) as DriveItem;
}

/**
 * Mirrors one document into the SharePoint library.
 *
 * Returns a result rather than throwing: every caller is a background task
 * whose only job is to record what happened, and an exception escaping into
 * `after()` would be lost.
 */
export async function mirrorDocument(
  category: DocumentCategory,
  title: string,
  version: string | null,
  originalName: string,
  file: Blob,
): Promise<MirrorResult> {
  if (!isMirrorable(category)) {
    return {
      ok: false,
      reason: "This category is deliberately not mirrored to SharePoint.",
      configured: true,
    };
  }

  const config = readGraphConfig(process.env);
  if (!config.ok) {
    return {
      ok: false,
      reason: `SharePoint is not configured: ${config.missing.join(", ")} not set.`,
      configured: false,
    };
  }

  const path = mirrorPath(category, title, version, originalName);

  try {
    const token = await getAccessToken(config.config);
    const item =
      uploadRoute(file.size) === "simple"
        ? await simpleUpload(config.config, token, path, file)
        : await sessionUpload(config.config, token, path, file);

    return { ok: true, webUrl: item.webUrl, path };
  } catch (cause) {
    // A stale cached token is the commonest cause of a one-off failure, so it
    // is dropped and the next attempt starts clean.
    cachedToken = null;
    return {
      ok: false,
      reason: cause instanceof Error ? cause.message : "The mirror failed.",
      configured: true,
    };
  }
}

/**
 * Checks the configuration by asking Graph for the library itself.
 *
 * Cheaper and safer than a test upload: it proves the credentials, the site,
 * the drive and the permission grant without leaving a file behind.
 */
export async function checkSharePointConnection(): Promise<
  { ok: true; libraryName: string; webUrl: string } | { ok: false; reason: string }
> {
  const config = readGraphConfig(process.env);
  if (!config.ok) {
    return { ok: false, reason: `Not configured: ${config.missing.join(", ")} not set.` };
  }

  try {
    const token = await getAccessToken(config.config);
    const response = await fetch(
      `${GRAPH}/sites/${config.config.siteId}/drives/${config.config.driveId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: `Graph answered ${response.status}. Check the site and drive ids, and that the app has been granted access to this site.`,
      };
    }

    const drive = (await response.json()) as { name: string; webUrl: string };
    return { ok: true, libraryName: drive.name, webUrl: drive.webUrl };
  } catch (cause) {
    cachedToken = null;
    return { ok: false, reason: cause instanceof Error ? cause.message : "Could not reach Graph." };
  }
}
