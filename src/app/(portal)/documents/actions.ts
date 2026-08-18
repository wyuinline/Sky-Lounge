"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import {
  bucketForCategory,
  documentCategories,
  type DocumentCategory,
} from "@/lib/document-categories";

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

  const bucketId = bucketForCategory(category);
  const storagePath = `${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(bucketId).upload(storagePath, file);
  if (uploadError) return { error: safeErrorMessage(uploadError, "upload") };

  const { error: insertError } = await supabase.from("documents").insert({
    title,
    category,
    uav_model: uavModel || null,
    department: department || null,
    storage_path: storagePath,
    uploaded_by: user?.id ?? null,
  });

  if (insertError) {
    // The file is already in the bucket. Without this the object would linger
    // with no metadata row — invisible to the UI and to any deletion flow,
    // which matters most for the restricted incident/regulatory buckets.
    await supabase.storage.from(bucketId).remove([storagePath]);
    return { error: safeErrorMessage(insertError, "upload") };
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
