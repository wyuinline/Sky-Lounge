"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { objectPath } from "@/lib/storage-paths";

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

async function requirePilotManager() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const };
  if (!access.canManage("pilots")) {
    return { error: "You do not have permission to change pilot records." as const };
  }
  return { error: null };
}

type PilotFields = {
  full_name: string;
  certificate_number: string | null;
  certificate_type: (typeof CERTIFICATE_TYPES)[number] | null;
  certificate_issued: string | null;
  certificate_expires: string | null;
  last_recency_activity: string | null;
  notes: string | null;
};

/** Shared by add and edit so the two cannot accept different data. */
function readPilotForm(
  formData: FormData,
): { error: string } | { error: null; fields: PilotFields } {
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

  return {
    error: null,
    fields: {
      full_name: fullName,
      certificate_number: certificateNumber || null,
      certificate_type: certificateType
        ? parseEnum(certificateType, CERTIFICATE_TYPES, "basic_operations")
        : null,
      certificate_issued: certificateIssued || null,
      certificate_expires: certificateExpires || null,
      last_recency_activity: lastRecencyActivity || null,
      notes: notes || null,
    },
  };
}

export async function addPilot(formData: FormData) {
  const guard = await requirePilotManager();
  if (guard.error) return { error: guard.error };

  const parsed = readPilotForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("pilots").insert(parsed.fields);

  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/pilots");
  revalidatePath("/");
  return { error: null };
}

/** Amends an existing pilot record. */
export async function updatePilot(pilotId: string, formData: FormData) {
  const guard = await requirePilotManager();
  if (guard.error) return { error: guard.error };
  if (!pilotId) return { error: "No pilot selected." };

  const parsed = readPilotForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("pilots")
    .update(parsed.fields, { count: "exact" })
    .eq("id", pilotId);

  if (error) return { error: safeErrorMessage(error, "update") };
  if (count === 0) return { error: "That pilot record no longer exists. Refresh and try again." };

  revalidatePath("/pilots");
  revalidatePath("/");
  return { error: null };
}

/**
 * Marks a pilot as departed, or brings them back.
 *
 * Their record and its certificate history stay — an audit covering last year
 * needs to see who was flying last year. They simply stop counting toward
 * credential alerts and stop appearing when logging a flight.
 */
export async function setPilotActive(pilotId: string, active: boolean) {
  const guard = await requirePilotManager();
  if (guard.error) return { error: guard.error };
  if (!pilotId) return { error: "No pilot selected." };

  const supabase = await createClient();
  const { error } = await supabase.from("pilots").update({ active }).eq("id", pilotId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/pilots");
  revalidatePath("/");
  return { error: null };
}

/**
 * Removes a pilot record entirely — only while nothing references it.
 *
 * For a row added by mistake. Anyone who has flown, filed a report, or holds a
 * training record is refused by the foreign keys, and should be marked as
 * departed instead.
 */
export async function deletePilot(pilotId: string) {
  const guard = await requirePilotManager();
  if (guard.error) return { error: guard.error };
  if (!pilotId) return { error: "No pilot selected." };

  const supabase = await createClient();
  const { error } = await supabase.from("pilots").delete().eq("id", pilotId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This pilot has flights, incidents, or training recorded against them, and that history has to be kept. Mark them as departed instead.",
      };
    }
    return { error: safeErrorMessage(error, "delete") };
  }

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
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };

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

  // Organisation first, pilot second — the storage policy that lets a pilot
  // read their own certificate reads the second segment for exactly this.
  const storagePath = objectPath(access.organisation.id, file.name, pilotId);

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
