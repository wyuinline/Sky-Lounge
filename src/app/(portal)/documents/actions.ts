"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { objectPath } from "@/lib/storage-paths";
import { isMirrorable } from "@/lib/sharepoint";
import { mirrorDocument } from "@/lib/sharepoint-client";
import {
  bucketForCategory,
  documentCategories,
  type DocumentCategory,
} from "@/lib/document-categories";
import { getAccess } from "@/lib/permissions";
import { todayIso } from "@/lib/compliance";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Documents are operational records — manuals, SOPs, evidence — so the
 * allowlist covers document formats only. HTML in particular is excluded:
 * served from a signed storage URL it would execute script on that origin.
 */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
]);

const categoryValues = documentCategories.map((c) => c.value);

export async function uploadDocument(formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = String(formData.get("title") ?? "").trim();
  const category = parseEnum<DocumentCategory>(
    formData.get("category"),
    categoryValues,
    "policy",
  );
  const uavModel = String(formData.get("uav_model") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const effectiveDate = String(formData.get("effective_date") ?? "");
  const expiresAt = String(formData.get("expires_at") ?? "");
  const intervalRaw = String(formData.get("review_interval_months") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!title || !file || file.size === 0) {
    return { error: "Add a title and choose a file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "That file is larger than the 25 MB limit." };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { error: "That file type isn't accepted. Upload a PDF, Office document, CSV, or image." };
  }

  // An empty interval means this document never needs reviewing, which is a
  // real answer (a ROC-A, a filed incident report) and not the same as zero.
  const reviewIntervalMonths = intervalRaw === "" ? null : Number(intervalRaw);
  if (
    reviewIntervalMonths !== null &&
    (!Number.isInteger(reviewIntervalMonths) || reviewIntervalMonths <= 0)
  ) {
    return { error: "The review cycle must be a whole number of months." };
  }

  if (effectiveDate && expiresAt && expiresAt < effectiveDate) {
    return { error: "The expiry date can't be before the effective date." };
  }

  const bucketId = bucketForCategory(category);
  // Under the organisation, because buckets are shared between operators and
  // a path is guessable in a way a row is not.
  const storagePath = objectPath(access.organisation.id, file.name);

  const { error: uploadError } = await supabase.storage.from(bucketId).upload(storagePath, file);
  if (uploadError) return { error: safeErrorMessage(uploadError, "upload") };

  const { data: inserted, error: insertError } = await supabase.from("documents").insert({
    title,
    category,
    uav_model: uavModel || null,
    department: department || null,
    storage_path: storagePath,
    uploaded_by: user?.id ?? null,
    // The review clock starts from when the version took effect, which is not
    // always the day it was filed.
    effective_date: effectiveDate || todayIso(),
    review_interval_months: reviewIntervalMonths,
    expires_at: expiresAt || null,
  }).select("id, version").single();

  if (insertError) {
    // The file is already in the bucket. Without this the object would linger
    // with no metadata row — invisible to the UI and to any deletion flow,
    // which matters most for the restricted incident/regulatory buckets.
    await supabase.storage.from(bucketId).remove([storagePath]);
    return { error: safeErrorMessage(insertError, "upload") };
  }

  // Mirrored after the response, never before it. A document filed in the
  // portal but not yet in SharePoint is a delay; a document refused because
  // SharePoint was unreachable is lost work.
  if (inserted && isMirrorable(category)) {
    after(async () => {
      // The portal stores version as a number; the mirrored filename carries
      // it as text, so the copy in SharePoint cites the same version an audit
      // would quote from the portal.
      const version = inserted.version === null ? null : String(inserted.version);
      const result = await mirrorDocument(category, title, version, file.name, file);
      await supabase
        .from("documents")
        .update(
          result.ok
            ? {
                sharepoint_url: result.webUrl,
                sharepoint_path: result.path,
                sharepoint_synced_at: new Date().toISOString(),
                sharepoint_error: null,
              }
            : // Recorded rather than logged, so the documents page can show
              // which copies are missing and why.
              { sharepoint_error: result.reason },
        )
        .eq("id", inserted.id);
    });
  }

  revalidatePath("/documents");
  return { error: null };
}

export async function getDownloadUrl(storagePath: string, category: DocumentCategory) {
  const supabase = await createClient();
  const safeCategory = parseEnum<DocumentCategory>(category, categoryValues, "policy");
  const bucketId = bucketForCategory(safeCategory);

  const { data, error } = await supabase.storage.from(bucketId).createSignedUrl(storagePath, 60);
  if (error || !data) {
    return { error: error ? safeErrorMessage(error, "download") : "Couldn't generate a download link." };
  }

  return { url: data.signedUrl, error: null };
}

/**
 * Records that someone has read a document and confirmed it still stands.
 *
 * This is the whole point of the review cycle: the clock restarts from the
 * review, not from the upload, so a document that gets looked at every year
 * never goes overdue and one that nobody opens eventually says so.
 */
export async function markDocumentReviewed(documentId: string) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!documentId) return { error: "No document selected." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("category, review_interval_months")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "That document no longer exists. Refresh and try again." };
  if (!doc.review_interval_months) {
    return { error: "This document has no review cycle, so there is nothing to restart." };
  }

  // Restricted categories are governed by their own permission, so a general
  // document manager must not be able to sign off a regulatory record.
  const restricted = doc.category === "regulatory" || doc.category === "incident_report";
  const area = restricted ? "docs_restricted" : "docs_general";
  if (!access.canManage(area)) {
    return { error: "You do not have permission to review this document." };
  }

  const { error } = await supabase
    .from("documents")
    .update({ last_reviewed_at: todayIso(), last_reviewed_by: access.userId })
    .eq("id", documentId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/documents");
  revalidatePath("/");
  return { error: null };
}

/**
 * Changes a document's review cycle, or clears it so it is never reviewed.
 */
export async function setDocumentReviewCycle(documentId: string, months: number | null) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("docs_general")) {
    return { error: "You do not have permission to change review cycles." };
  }
  if (months !== null && (!Number.isInteger(months) || months <= 0)) {
    return { error: "The review cycle must be a whole number of months." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ review_interval_months: months })
    .eq("id", documentId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/documents");
  return { error: null };
}
