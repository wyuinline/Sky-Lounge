/**
 * SharePoint document mirroring.
 *
 * The original brief was a SharePoint site, and the portal replaced it because
 * SharePoint lists cannot carry approval workflows, real permissions or a
 * relational model. But the company's documents still live in SharePoint, and
 * the people who read an SOP are used to finding it there — so the portal
 * mirrors what it holds into a SharePoint library rather than asking everyone
 * to change where they look.
 *
 * The portal stays the system of record. The mirror is a copy, one-way, and a
 * failed mirror never blocks an upload: a document filed in the portal and not
 * yet in SharePoint is a delay, while a document rejected because SharePoint
 * was unreachable is lost work.
 *
 * The pure parts — configuration, paths, which upload route a file takes — are
 * here and tested. The Graph calls sit beneath them in sharepoint-client.ts.
 */

import type { Database } from "@/lib/database.types";

type DocumentCategory = Database["public"]["Enums"]["document_category"];

/**
 * Where each category lands in the library.
 *
 * Mirrors the folder names from the original SharePoint plan, so the mirrored
 * tree is the one people already know rather than a new one to learn.
 */
export const SHAREPOINT_FOLDERS: Record<DocumentCategory, string> = {
  sop: "Standard Operating Procedures",
  policy: "Policies",
  flight_manual: "Flight Manuals",
  maintenance_manual: "Maintenance Manuals",
  regulatory: "Regulatory Documents",
  incident_report: "Incident Reports",
  training_material: "Training Materials",
  safety_document: "Safety Documents",
  roc_a: "ROC-A Certificates",
};

/**
 * Categories that are never mirrored.
 *
 * Restricted material is restricted in the portal by RLS keyed to a role. A
 * SharePoint library has its own permissions, set by someone else, changed
 * without anyone here knowing — so copying an incident report or a regulatory
 * filing out of the portal would quietly move it outside the access control
 * that was the reason for building the portal in the first place.
 */
export const NEVER_MIRRORED: DocumentCategory[] = [
  "regulatory",
  "incident_report",
  // A ROC-A is somebody's personal certificate. The portal restricts it to the
  // holder and the UAV admin; a SharePoint library would not.
  "roc_a",
];

export function isMirrorable(category: DocumentCategory): boolean {
  return !NEVER_MIRRORED.includes(category);
}

export type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  /** The document library's drive id. */
  driveId: string;
};

/**
 * Reads the configuration, or says precisely what is missing.
 *
 * Returning the list of absent variables rather than a bare null is what lets
 * the settings page tell an administrator which half of the Azure app
 * registration they have not finished.
 */
export function readGraphConfig(
  env: Record<string, string | undefined>,
): { ok: true; config: GraphConfig } | { ok: false; missing: string[] } {
  const required = {
    AZURE_TENANT_ID: env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: env.AZURE_CLIENT_SECRET,
    SHAREPOINT_SITE_ID: env.SHAREPOINT_SITE_ID,
    SHAREPOINT_DRIVE_ID: env.SHAREPOINT_DRIVE_ID,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value || value.trim() === "")
    .map(([name]) => name);

  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    config: {
      tenantId: required.AZURE_TENANT_ID as string,
      clientId: required.AZURE_CLIENT_ID as string,
      clientSecret: required.AZURE_CLIENT_SECRET as string,
      siteId: required.SHAREPOINT_SITE_ID as string,
      driveId: required.SHAREPOINT_DRIVE_ID as string,
    },
  };
}

/**
 * Makes a filename SharePoint will accept.
 *
 * SharePoint rejects " * : < > ? / \ | # %, leading and trailing spaces, names
 * ending in a full stop, and a handful of reserved names. A rejected filename
 * fails the whole upload, so it is worth normalising rather than discovering
 * at the far end.
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/["*:<>?/\\|#%]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");

  // A name of only stripped characters would otherwise become an empty path
  // segment, which Graph reads as the folder itself.
  return cleaned === "" ? "document" : cleaned.slice(0, 200);
}

/**
 * The path a document takes inside the library.
 *
 * The version is in the filename rather than relying on SharePoint's own
 * version history, because the portal's version is the one people cite in an
 * audit and the two would otherwise drift apart.
 */
export function mirrorPath(
  category: DocumentCategory,
  title: string,
  version: string | null,
  originalName: string,
): string {
  const folder = SHAREPOINT_FOLDERS[category];
  const extension = originalName.includes(".")
    ? `.${originalName.split(".").pop()}`
    : "";
  const versionSuffix = version && version.trim() !== "" ? ` v${version.trim()}` : "";
  const base = safeFileName(`${title}${versionSuffix}`);
  return `${folder}/${base}${extension.toLowerCase()}`;
}

/**
 * Graph's simple upload tops out at 4 MB; anything larger needs a resumable
 * upload session. The portal's own limit is 25 MB, so both routes are real.
 */
export const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;

export function uploadRoute(sizeBytes: number): "simple" | "session" {
  return sizeBytes <= SIMPLE_UPLOAD_LIMIT ? "simple" : "session";
}

/** Chunk size for a resumable upload. Graph requires a multiple of 320 KiB. */
export const CHUNK_SIZE = 5 * 320 * 1024;

export type Chunk = { start: number; end: number; contentRange: string };

/**
 * Splits a file into the ranges a resumable upload sends.
 *
 * Graph's Content-Range is inclusive at both ends and must cover the file
 * exactly — an off-by-one here fails the final chunk and discards the upload,
 * which is precisely the kind of thing worth a test rather than a careful read.
 */
export function planChunks(sizeBytes: number, chunkSize = CHUNK_SIZE): Chunk[] {
  if (sizeBytes <= 0) return [];
  const chunks: Chunk[] = [];
  for (let start = 0; start < sizeBytes; start += chunkSize) {
    const end = Math.min(start + chunkSize, sizeBytes) - 1;
    chunks.push({ start, end, contentRange: `bytes ${start}-${end}/${sizeBytes}` });
  }
  return chunks;
}

/**
 * Whether a cached access token is still worth using.
 *
 * Sixty seconds of headroom: a token that expires while a 25 MB upload is in
 * flight fails halfway, which is worse than fetching one a minute early.
 */
export const TOKEN_SKEW_MS = 60_000;

export function tokenIsFresh(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && expiresAt - TOKEN_SKEW_MS > now;
}

/** When a token issued now, valid for `expiresInSeconds`, stops being usable. */
export function tokenExpiry(expiresInSeconds: number, now: number): number {
  return now + expiresInSeconds * 1000;
}
