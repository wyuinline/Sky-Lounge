"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage, parseEnum } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";

const BATTERY_STATUSES = ["serviceable", "monitor", "retired"] as const;

type BatteryFields = {
  battery_id: string;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  capacity_mah: number | null;
  cell_count: number | null;
  purchased_date: string | null;
  baseline_cycles: number;
  cycle_limit: number | null;
  status: (typeof BATTERY_STATUSES)[number];
  location_site: string | null;
  notes: string | null;
};

/**
 * Reads and validates the battery form, shared by add and edit so the two
 * cannot drift into accepting different data.
 */
function readBatteryForm(
  formData: FormData,
): { error: string } | { error: null; fields: BatteryFields } {
  const batteryId = String(formData.get("battery_id") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const serialNumber = String(formData.get("serial_number") ?? "").trim();
  const capacityRaw = String(formData.get("capacity_mah") ?? "").trim();
  const cellsRaw = String(formData.get("cell_count") ?? "").trim();
  const purchasedDate = String(formData.get("purchased_date") ?? "");
  const baselineRaw = String(formData.get("baseline_cycles") ?? "").trim();
  const limitRaw = String(formData.get("cycle_limit") ?? "").trim();
  const status = parseEnum(formData.get("status"), BATTERY_STATUSES, "serviceable");
  const locationSite = String(formData.get("location_site") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!batteryId) return { error: "Give the pack an ID — whatever is written on it." };

  const wholeOrNull = (raw: string, label: string) => {
    if (raw === "") return { value: null as number | null, error: null as string | null };
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      return { value: null, error: `${label} must be a whole number greater than zero.` };
    }
    return { value: n, error: null };
  };

  const capacity = wholeOrNull(capacityRaw, "Capacity");
  if (capacity.error) return { error: capacity.error };
  const cells = wholeOrNull(cellsRaw, "Cell count");
  if (cells.error) return { error: cells.error };
  const limit = wholeOrNull(limitRaw, "Cycle limit");
  if (limit.error) return { error: limit.error };

  const baselineCycles = baselineRaw === "" ? 0 : Number(baselineRaw);
  if (!Number.isInteger(baselineCycles) || baselineCycles < 0) {
    return { error: "Existing cycles must be zero or a whole number." };
  }

  // A limit already below the cycles on the pack would put it permanently
  // overdue the moment it is saved, which is almost always a typo.
  if (limit.value !== null && limit.value < baselineCycles) {
    return { error: "The cycle limit is below the cycles already on this pack. Check both." };
  }

  return {
    error: null,
    fields: {
      battery_id: batteryId,
      model: model || null,
      manufacturer: manufacturer || null,
      serial_number: serialNumber || null,
      capacity_mah: capacity.value,
      cell_count: cells.value,
      purchased_date: purchasedDate || null,
      baseline_cycles: baselineCycles,
      cycle_limit: limit.value,
      status,
      location_site: locationSite || null,
      notes: notes || null,
    },
  };
}

async function requireFleetManager() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const };
  if (!access.canManage("fleet")) {
    return { error: "You do not have permission to change the fleet." as const };
  }
  return { error: null };
}

export async function addBattery(formData: FormData) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };

  const parsed = readBatteryForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("batteries").insert(parsed.fields);
  if (error) return { error: safeErrorMessage(error, "save") };

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

export async function updateBattery(batteryId: string, formData: FormData) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!batteryId) return { error: "No battery selected." };

  const parsed = readBatteryForm(formData);
  if (parsed.error !== null) return { error: parsed.error };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("batteries")
    .update(parsed.fields, { count: "exact" })
    .eq("id", batteryId);

  if (error) return { error: safeErrorMessage(error, "update") };
  if (count === 0) return { error: "That battery no longer exists. Refresh and try again." };

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

/**
 * Takes a pack out of service, or brings it back.
 *
 * As with airframes, this is the ordinary end of a battery's life: the flights
 * it flew are part of the maintenance record and have to stay.
 */
export async function setBatteryStatus(batteryId: string, status: string) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!batteryId) return { error: "No battery selected." };

  const next = parseEnum(status, BATTERY_STATUSES, "serviceable");
  if (next !== status) return { error: "That is not a battery status this portal recognises." };

  const supabase = await createClient();
  const { error } = await supabase.from("batteries").update({ status: next }).eq("id", batteryId);
  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}

/**
 * Removes a pack entirely — only while no flight references it.
 *
 * For a duplicate or mistyped entry. Anything that has flown is refused by the
 * foreign key, because its cycles are part of an airframe's service history.
 */
export async function deleteBattery(batteryId: string) {
  const guard = await requireFleetManager();
  if (guard.error) return { error: guard.error };
  if (!batteryId) return { error: "No battery selected." };

  const supabase = await createClient();
  const { error } = await supabase.from("batteries").delete().eq("id", batteryId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This pack has flights recorded against it, and those cycles are part of the maintenance record. Retire it instead.",
      };
    }
    return { error: safeErrorMessage(error, "delete") };
  }

  revalidatePath("/fleet");
  revalidatePath("/");
  return { error: null };
}
