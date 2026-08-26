"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";

const PROJECT_STATUSES = ["planned", "active", "on_hold", "complete", "cancelled"] as const;

async function requireProjectManager() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const };
  if (!access.canManage("requests")) {
    return { error: "You do not have permission to manage projects." as const };
  }
  return { error: null };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

function readClientForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Give the client a name." as const, fields: null };
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { error: "That contact email is not valid." as const, fields: null };
  }

  return {
    error: null,
    fields: {
      name,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      notes: notes || null,
    },
  };
}

export async function addClient(formData: FormData) {
  const guard = await requireProjectManager();
  if (guard.error) return { error: guard.error };

  const parsed = readClientForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert(parsed.fields);
  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/projects");
  return { error: null };
}

export async function setClientActive(clientId: string, active: boolean) {
  const guard = await requireProjectManager();
  if (guard.error) return { error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ active }).eq("id", clientId);
  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/projects");
  return { error: null };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

type ProjectFields = {
  project_code: string;
  name: string;
  client_id: string | null;
  site_name: string | null;
  latitude: number | null;
  longitude: number | null;
  status: (typeof PROJECT_STATUSES)[number];
  start_date: string | null;
  end_date: string | null;
  hourly_rate: number | null;
  notes: string | null;
};

function readProjectForm(
  formData: FormData,
): { error: string } | { error: null; fields: ProjectFields } {
  const projectCode = String(formData.get("project_code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const siteName = String(formData.get("site_name") ?? "").trim();
  const latRaw = String(formData.get("latitude") ?? "").trim();
  const lngRaw = String(formData.get("longitude") ?? "").trim();
  const status = parseEnum(formData.get("status"), PROJECT_STATUSES, "planned");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const rateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!projectCode) return { error: "Give the project its job number." };
  if (!name) return { error: "Give the project a name." };

  if (startDate && endDate && endDate < startDate) {
    return { error: "The end date cannot be before the start date." };
  }

  const coord = (raw: string, label: string, limit: number) => {
    if (raw === "") return { value: null as number | null, error: null as string | null };
    const n = Number(raw);
    if (!Number.isFinite(n) || Math.abs(n) > limit) {
      return { value: null, error: `${label} must be between -${limit} and ${limit}.` };
    }
    return { value: n, error: null };
  };

  const lat = coord(latRaw, "Latitude", 90);
  if (lat.error) return { error: lat.error };
  const lng = coord(lngRaw, "Longitude", 180);
  if (lng.error) return { error: lng.error };
  if ((lat.value === null) !== (lng.value === null)) {
    return { error: "Give both latitude and longitude, or neither." };
  }

  const hourlyRate = rateRaw === "" ? null : Number(rateRaw);
  if (hourlyRate !== null && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) {
    return { error: "The hourly rate must be zero or more." };
  }

  return {
    error: null,
    fields: {
      project_code: projectCode,
      name,
      client_id: clientId || null,
      site_name: siteName || null,
      latitude: lat.value,
      longitude: lng.value,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      hourly_rate: hourlyRate,
      notes: notes || null,
    },
  };
}

export async function addProject(formData: FormData) {
  const guard = await requireProjectManager();
  if (guard.error) return { error: guard.error };

  const parsed = readProjectForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert(parsed.fields);
  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/projects");
  revalidatePath("/flights");
  return { error: null };
}

export async function updateProject(projectId: string, formData: FormData) {
  const guard = await requireProjectManager();
  if (guard.error) return { error: guard.error };
  if (!projectId) return { error: "No project selected." };

  const parsed = readProjectForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("projects")
    .update(parsed.fields, { count: "exact" })
    .eq("id", projectId);

  if (error) return { error: safeErrorMessage(error, "update") };
  if (count === 0) return { error: "That project no longer exists. Refresh and try again." };

  revalidatePath("/projects");
  revalidatePath("/flights");
  return { error: null };
}

export async function setProjectStatus(projectId: string, status: string) {
  const guard = await requireProjectManager();
  if (guard.error) return { error: guard.error };

  const next = parseEnum(status, PROJECT_STATUSES, "planned");
  if (next !== status) return { error: "That is not a project status this portal recognises." };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status: next }).eq("id", projectId);
  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/projects");
  revalidatePath("/flights");
  return { error: null };
}

/**
 * Removes a project entirely.
 *
 * Flights reference it with ON DELETE SET NULL, so deleting a project that has
 * flown would quietly orphan those hours — the flights survive but stop
 * belonging to any job, and the utilisation figures change with no trace. So
 * this refuses while any flight points at it, and the project is marked
 * complete or cancelled instead.
 */
export async function deleteProject(projectId: string) {
  const guard = await requireProjectManager();
  if (guard.error) return { error: guard.error };
  if (!projectId) return { error: "No project selected." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("flight_logs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if ((count ?? 0) > 0) {
    return {
      error: `This project has ${count} flight${count === 1 ? "" : "s"} recorded against it. Mark it complete or cancelled instead — deleting it would detach those hours from the job.`,
    };
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { error: safeErrorMessage(error, "delete") };

  revalidatePath("/projects");
  revalidatePath("/flights");
  return { error: null };
}
