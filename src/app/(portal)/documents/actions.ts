"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bucketForCategory, type DocumentCategory } from "@/lib/document-categories";

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "policy") as DocumentCategory;
  const uavModel = String(formData.get("uav_model") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!title || !file || file.size === 0) {
    return { error: "Title and a file are required." };
  }

  const bucketId = bucketForCategory(category);
  const storagePath = `${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(bucketId).upload(storagePath, file);
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("documents").insert({
    title,
    category,
    uav_model: uavModel || null,
    department: department || null,
    storage_path: storagePath,
    uploaded_by: user?.id ?? null,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/documents");
  return { error: null };
}

export async function getDownloadUrl(storagePath: string, category: DocumentCategory) {
  const supabase = await createClient();
  const bucketId = bucketForCategory(category);

  const { data, error } = await supabase.storage.from(bucketId).createSignedUrl(storagePath, 60);
  if (error || !data) return { error: error?.message ?? "Could not generate download link." };

  return { url: data.signedUrl, error: null };
}
