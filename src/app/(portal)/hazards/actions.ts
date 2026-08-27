"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { todayIso } from "@/lib/compliance";
import {
  likelihoodOrder,
  severityOrder,
  type Likelihood,
  type Severity,
} from "@/lib/risk";

/**
 * Narrowing guards rather than casts: the form sends strings, the database
 * wants enum members, and a cast would let a typo through to a constraint
 * violation instead of a message.
 */
function isLikelihood(v: string): v is Likelihood {
  return (likelihoodOrder as string[]).includes(v);
}
function isSeverity(v: string): v is Severity {
  return (severityOrder as string[]).includes(v);
}

const HAZARD_STATUSES = ["open", "mitigated", "accepted", "closed"] as const;
const HAZARD_CATEGORIES = [
  "operational",
  "technical",
  "environmental",
  "human_factors",
  "regulatory",
  "security",
] as const;

async function requireSafetyManager() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const };
  if (!access.canManage("incidents")) {
    return { error: "You do not have permission to manage the hazard register." as const };
  }
  return { error: null };
}

type HazardFields = {
  hazard_code: string;
  title: string;
  description: string | null;
  category: (typeof HAZARD_CATEGORIES)[number];
  initial_likelihood: Likelihood;
  initial_severity: Severity;
  mitigation: string | null;
  residual_likelihood: Likelihood | null;
  residual_severity: Severity | null;
  owner_id: string | null;
  status: (typeof HAZARD_STATUSES)[number];
  review_interval_months: number;
  notes: string | null;
};

function readHazardForm(
  formData: FormData,
): { error: string } | { error: null; fields: HazardFields } {
  const hazardCode = String(formData.get("hazard_code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = parseEnum(formData.get("category"), HAZARD_CATEGORIES, "operational");
  const initialLikelihood = String(formData.get("initial_likelihood") ?? "");
  const initialSeverity = String(formData.get("initial_severity") ?? "");
  const mitigation = String(formData.get("mitigation") ?? "").trim();
  const residualLikelihood = String(formData.get("residual_likelihood") ?? "").trim();
  const residualSeverity = String(formData.get("residual_severity") ?? "").trim();
  const ownerId = String(formData.get("owner_id") ?? "").trim();
  const status = parseEnum(formData.get("status"), HAZARD_STATUSES, "open");
  const intervalRaw = String(formData.get("review_interval_months") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!hazardCode) return { error: "Give the hazard a reference." };
  if (!title) return { error: "Describe the hazard in a line." };

  if (!isLikelihood(initialLikelihood)) {
    return { error: "Choose how likely this hazard is." };
  }
  if (!isSeverity(initialSeverity)) {
    return { error: "Choose how severe this hazard would be." };
  }

  // Residual risk is a pair or it is nothing — the database enforces this too,
  // but a clear message beats a constraint violation.
  const hasResidual = residualLikelihood !== "" || residualSeverity !== "";
  if (hasResidual && !(isLikelihood(residualLikelihood) && isSeverity(residualSeverity))) {
    return { error: "Set both residual likelihood and severity, or neither." };
  }

  const interval = intervalRaw === "" ? 12 : Number(intervalRaw);
  if (!Number.isInteger(interval) || interval <= 0) {
    return { error: "The review interval must be a whole number of months." };
  }

  return {
    error: null,
    fields: {
      hazard_code: hazardCode,
      title,
      description: description || null,
      category,
      initial_likelihood: initialLikelihood,
      initial_severity: initialSeverity,
      mitigation: mitigation || null,
      residual_likelihood: isLikelihood(residualLikelihood) ? residualLikelihood : null,
      residual_severity: isSeverity(residualSeverity) ? residualSeverity : null,
      owner_id: ownerId || null,
      status,
      review_interval_months: interval,
      notes: notes || null,
    },
  };
}

export async function addHazard(formData: FormData) {
  const guard = await requireSafetyManager();
  if (guard.error) return { error: guard.error };

  const parsed = readHazardForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("hazards").insert(parsed.fields);
  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/hazards");
  revalidatePath("/");
  return { error: null };
}

export async function updateHazard(hazardId: string, formData: FormData) {
  const guard = await requireSafetyManager();
  if (guard.error) return { error: guard.error };
  if (!hazardId) return { error: "No hazard selected." };

  const parsed = readHazardForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("hazards")
    .update(parsed.fields, { count: "exact" })
    .eq("id", hazardId);

  if (error) return { error: safeErrorMessage(error, "update") };
  if (count === 0) return { error: "That hazard no longer exists. Refresh and try again." };

  revalidatePath("/hazards");
  revalidatePath("/");
  return { error: null };
}

/**
 * Records that the hazard has been re-read and still reflects the operation.
 *
 * The review clock restarts from today, exactly as for a controlled document —
 * a register nobody revisits is a document, not a control.
 */
export async function markHazardReviewed(hazardId: string) {
  const guard = await requireSafetyManager();
  if (guard.error) return { error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hazards")
    .update({ last_reviewed_at: todayIso() })
    .eq("id", hazardId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/hazards");
  revalidatePath("/");
  return { error: null };
}

/**
 * Records that an incident is evidence of a hazard.
 *
 * This is the link that turns separate records into a safety management
 * system: a hazard with incidents against it is one whose controls are not
 * working, whatever its residual score claims.
 */
export async function linkIncidentToHazard(hazardId: string, incidentId: string) {
  const guard = await requireSafetyManager();
  if (guard.error) return { error: guard.error };
  if (!hazardId || !incidentId) return { error: "Choose a hazard and an incident." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hazard_incidents")
    .insert({ hazard_id: hazardId, incident_id: incidentId });

  if (error) {
    if (error.code === "23505") return { error: "That incident is already linked to this hazard." };
    return { error: safeErrorMessage(error, "link") };
  }

  revalidatePath("/hazards");
  revalidatePath("/incidents");
  return { error: null };
}

export async function unlinkIncidentFromHazard(hazardId: string, incidentId: string) {
  const guard = await requireSafetyManager();
  if (guard.error) return { error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hazard_incidents")
    .delete()
    .eq("hazard_id", hazardId)
    .eq("incident_id", incidentId);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/hazards");
  revalidatePath("/incidents");
  return { error: null };
}

export async function deleteHazard(hazardId: string) {
  const guard = await requireSafetyManager();
  if (guard.error) return { error: guard.error };

  const supabase = await createClient();

  const { count } = await supabase
    .from("hazard_incidents")
    .select("id", { count: "exact", head: true })
    .eq("hazard_id", hazardId);

  if ((count ?? 0) > 0) {
    return {
      error: `This hazard has ${count} incident${count === 1 ? "" : "s"} linked to it, and that history is part of the safety record. Close it instead.`,
    };
  }

  const { error } = await supabase.from("hazards").delete().eq("id", hazardId);
  if (error) return { error: safeErrorMessage(error, "delete") };

  revalidatePath("/hazards");
  revalidatePath("/");
  return { error: null };
}
