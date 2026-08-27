"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/action-utils";
import { getAccess } from "@/lib/permissions";
import { operationOrder, type OperationType } from "@/lib/operations";

async function requireCrewManager() {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in." as const, userId: null };
  if (!access.canManage("pilots")) {
    return { error: "You do not have permission to authorise crew." as const, userId: null };
  }
  return { error: null, userId: access.userId };
}

function isOperation(v: string): v is OperationType {
  return (operationOrder as string[]).includes(v);
}

/**
 * Records that a pilot is cleared for an operation type.
 *
 * Evidence is required, not optional: an authorisation with nothing behind it
 * is an opinion, and the point of the record is that an auditor can follow it
 * to a certificate, a check ride or a training record.
 */
export async function grantAuthorisation(
  pilotId: string,
  operation: string,
  evidence: string,
  expiresOn: string,
) {
  const guard = await requireCrewManager();
  if (guard.error) return { error: guard.error };

  if (!pilotId) return { error: "No pilot selected." };
  if (!isOperation(operation)) {
    return { error: "That is not an operation type this portal recognises." };
  }

  const backing = evidence.trim();
  if (!backing) {
    return {
      error:
        "Say what backs this authorisation — a certificate, a check ride, an SFOC. One with no evidence behind it is an opinion.",
    };
  }

  const supabase = await createClient();

  // Re-granting replaces the previous record rather than failing on the unique
  // constraint: renewing an authorisation is the common case, and making
  // someone delete the old one first would invite them to skip the evidence.
  const { error } = await supabase.from("pilot_authorisations").upsert(
    {
      pilot_id: pilotId,
      operation,
      evidence: backing,
      expires_on: expiresOn || null,
      authorised_by: guard.userId,
      authorised_on: new Date().toISOString().slice(0, 10),
    },
    { onConflict: "pilot_id,operation" },
  );

  if (error) return { error: safeErrorMessage(error, "authorisation") };

  revalidatePath("/pilots");
  revalidatePath("/flights");
  return { error: null };
}

/**
 * Withdraws an authorisation entirely.
 *
 * Distinct from letting one lapse: a lapse is a date passing, a withdrawal is
 * a decision. Flights already flown under it are untouched — this governs what
 * may be booked from now on.
 */
export async function revokeAuthorisation(pilotId: string, operation: string) {
  const guard = await requireCrewManager();
  if (guard.error) return { error: guard.error };
  if (!isOperation(operation)) {
    return { error: "That is not an operation type this portal recognises." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pilot_authorisations")
    .delete()
    .eq("pilot_id", pilotId)
    .eq("operation", operation);

  if (error) return { error: safeErrorMessage(error, "update") };

  revalidatePath("/pilots");
  revalidatePath("/flights");
  return { error: null };
}
