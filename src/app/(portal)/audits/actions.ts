"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";

const AUDIT_TYPES = ["internal", "regulatory"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export async function scheduleAudit(formData: FormData) {
  const supabase = await createClient();

  const auditType = parseEnum(formData.get("audit_type"), AUDIT_TYPES, "internal");
  const auditDate = String(formData.get("audit_date") ?? "");
  const auditorId = String(formData.get("auditor_id") ?? "");

  if (!auditDate) {
    return { error: "Set the audit date." };
  }

  const { error } = await supabase.from("audits").insert({
    audit_type: auditType,
    audit_date: auditDate,
    auditor_id: auditorId || null,
    status: "planned",
  });

  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/audits");
  revalidatePath("/");
  return { error: null };
}

export async function addFinding(formData: FormData) {
  const supabase = await createClient();

  const auditId = String(formData.get("audit_id") ?? "");
  const severity = parseEnum(formData.get("severity"), SEVERITIES, "low");
  const description = String(formData.get("description") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? "");
  const dueDate = String(formData.get("due_date") ?? "");
  // The safety loop: what raised this, what it addresses, what it changed.
  const incidentId = String(formData.get("incident_id") ?? "").trim();
  const hazardId = String(formData.get("hazard_id") ?? "").trim();
  const documentId = String(formData.get("resulting_document_id") ?? "").trim();
  const trainingRequired = formData.get("training_required") === "on";

  if (!auditId || !description) {
    return { error: "Choose an audit and describe the finding." };
  }

  const { error } = await supabase.from("audit_findings").insert({
    audit_id: auditId,
    severity,
    description,
    assigned_to: assignedTo || null,
    due_date: dueDate || null,
    incident_id: incidentId || null,
    hazard_id: hazardId || null,
    resulting_document_id: documentId || null,
    training_required: trainingRequired,
  });

  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/audits");
  revalidatePath("/");
  return { error: null };
}
