"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { objectPath } from "@/lib/storage-paths";

/**
 * An operator's own settings.
 *
 * Everything here is about how the organisation presents itself — its name on
 * a report, the certificate it flies under, the mark in the corner of every
 * page. What it may not touch is its own existence: activating and deactivating
 * an operator is the platform's job, and there is no policy that would let this
 * do it.
 */

const LOGO_BUCKET = "organisation-logos";
const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

export async function updateOrganisation(formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to change these settings." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "The operator needs a name." };

  const legalName = String(formData.get("legal_name") ?? "").trim();
  const rpocNumber = String(formData.get("rpoc_number") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const accent = String(formData.get("accent_colour") ?? "").trim();

  // Checked here as well as by the database, because the value ends up in a
  // CSS custom property and the error should read like a sentence rather than
  // a constraint violation.
  if (accent !== "" && !/^#[0-9a-fA-F]{6}$/.test(accent)) {
    return { error: "The accent colour needs to be a six-digit hex code, like #c4e86c." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organisations")
    .update({
      name,
      legal_name: legalName || null,
      rpoc_number: rpocNumber || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      accent_colour: accent === "" ? null : accent.toLowerCase(),
    })
    .eq("id", access.organisation.id);

  if (error) return { error: safeErrorMessage(error, "settings") };

  // The name and colours are in the shell on every page, so everything is stale.
  revalidatePath("/", "layout");
  return { error: null };
}

export async function uploadLogo(formData: FormData) {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to change the logo." };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Choose an image to upload." };
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "That image is larger than the 1 MB limit." };
  }
  if (!LOGO_TYPES.has(file.type)) {
    return { error: "Upload a PNG, JPEG, SVG or WebP." };
  }

  const supabase = await createClient();
  const path = objectPath(access.organisation.id, file.name);

  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file);
  if (uploadError) return { error: safeErrorMessage(uploadError, "upload") };

  const previous = access.organisation.logoPath;
  const { error } = await supabase
    .from("organisations")
    .update({ logo_path: path })
    .eq("id", access.organisation.id);

  if (error) {
    // Otherwise the object lingers with nothing pointing at it.
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
    return { error: safeErrorMessage(error, "logo") };
  }

  if (previous && previous !== path) {
    await supabase.storage.from(LOGO_BUCKET).remove([previous]);
  }

  revalidatePath("/", "layout");
  return { error: null };
}

export async function removeLogo() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." };
  if (!access.canManage("users")) {
    return { error: "You do not have permission to change the logo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organisations")
    .update({ logo_path: null })
    .eq("id", access.organisation.id);

  if (error) return { error: safeErrorMessage(error, "logo") };

  if (access.organisation.logoPath) {
    await supabase.storage.from(LOGO_BUCKET).remove([access.organisation.logoPath]);
  }

  revalidatePath("/", "layout");
  return { error: null };
}
