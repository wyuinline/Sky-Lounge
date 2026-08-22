"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";

const CERTIFICATE_TYPES = [
  "basic_operations",
  "advanced_operations",
  "level_1_complex",
] as const;

const ROC_A_BUCKET = "roc-a-certificates";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

export async function addPilot(formData: FormData) {
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const certificateNumber = String(formData.get("certificate_number") ?? "").trim();
  const certificateType = String(formData.get("certificate_type") ?? "");
  const certificateIssued = String(formData.get("certificate_issued") ?? "");
  const certificateExpires = String(formData.get("certificate_expires") ?? "");
  const lastRecencyActivity = String(formData.get("last_recency_activity") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!fullName) {
    return { error: "Enter the pilot's name." };
  }

  if (certificateIssued && certificateExpires && certificateExpires < certificateIssued) {
    return { error: "The expiry date can't be before the issue date." };
  }

  const { error } = await supabase.from("pilots").insert({
    full_name: fullName,
    certificate_number: certificateNumber || null,
    certificate_type: certificateType
      ? parseEnum(certificateType, CERTIFICATE_TYPES, "basic_operations")
      : null,
    certificate_issued: certificateIssued || null,
    certificate_expires: certificateExpires || null,
    last_recency_activity: lastRecencyActivity || null,
    notes: notes || null,
  });

  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/pilots");
  revalidatePath("/");
  return { error: null };
}

/**
 * Uploads a ROC-A certificate and links it to the pilot.
 *
 * The ROC-A tick on the pilots page is derived from the presence of this
 * document, so it cannot be set without the certificate actually being on
 * file — an unverifiable tick is worthless in an audit.
 */
export async function uploadRocA(pilotId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const file = formData.get("file") as File | null;

  if (!pilotId) return { error: "No pilot selected." };
  if (!file || file.size === 0) return { error: "Choose a certificate file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That file is larger than the 10 MB limit." };
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { error: "Upload the certificate as a PDF or an image." };
  }

  const { data: pilot, error: pilotError } = await supabase
    .from("pilots")
    .select("id, full_name")
    .eq("id", pilotId)
    .single();

  if (pilotError || !pilot) {
    return { error: "That pilot no longer exists. Refresh and try again." };
  }

  const storagePath = `${pilotId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(ROC_A_BUCKET)
    .upload(storagePath, file);
  if (uploadError) return { error: safeErrorMessage(uploadError, "upload") };

  const { error: insertError } = await supabase.from("documents").insert({
    title: `ROC-A — ${pilot.full_name}`,
    category: "roc_a",
    storage_path: storagePath,
    pilot_id: pilotId,
    uploaded_by: user?.id ?? null,
  });

  if (insertError) {
    // Otherwise the file lingers with no record pointing at it, and the ROC-A
    // tick stays unticked while the certificate sits in storage unreferenced.
    await supabase.storage.from(ROC_A_BUCKET).remove([storagePath]);
    return { error: safeErrorMessage(insertError, "upload") };
  }

  revalidatePath("/pilots");
  return { error: null };
}
