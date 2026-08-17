"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function scheduleAudit(formData: FormData) {
  const supabase = await createClient();

  const auditType = String(formData.get("audit_type") ?? "internal");
  const auditDate = String(formData.get("audit_date") ?? "");
  const auditorId = String(formData.get("auditor_id") ?? "");

  if (!auditDate) {
    return { error: "Audit date is required." };
  }

  const { error } = await supabase.from("audits").insert({
    audit_type: auditType,
    audit_date: auditDate,
    auditor_id: auditorId || null,
    status: "planned",
  });

  if (error) return { error: error.message };

  revalidatePath("/audits");
  revalidatePath("/");
  return { error: null };
}

export async function addFinding(formData: FormData) {
  const supabase = await createClient();

  const auditId = String(formData.get("audit_id") ?? "");
  const severity = String(formData.get("severity") ?? "low");
  const description = String(formData.get("description") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "");
  const dueDate = String(formData.get("due_date") ?? "");

  if (!auditId || !description) {
    return { error: "Audit and description are required." };
  }

  const { error } = await supabase.from("audit_findings").insert({
    audit_id: auditId,
    severity,
    description,
    assigned_to: assignedTo || null,
    due_date: dueDate || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/audits");
  revalidatePath("/");
  return { error: null };
}
