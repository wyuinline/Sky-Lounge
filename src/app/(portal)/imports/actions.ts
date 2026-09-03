"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/action-utils";
import { getAccess, type AccessArea } from "@/lib/permissions";
import { parseImport, importableRows, type DateFormat } from "@/lib/csv-import";
import { schemaFor, type ImportEntity } from "@/lib/import-schemas";

/**
 * Committing a bulk import.
 *
 * The file is parsed again here rather than trusting what the browser worked
 * out. The preview exists so a person can look before anything is written; it
 * is not evidence about the file, and treating a client-side verdict as
 * authorisation to insert would let anyone post whatever rows they liked.
 *
 * organisation_id is never set. It defaults to the caller's organisation at
 * the database, the not-null keeps it from being skipped, and the with-check
 * clause refuses a mismatch — so a bulk insert is scoped by exactly the same
 * mechanism as a single form submission, with no second implementation to get
 * wrong.
 */

/** Which permission each import needs. */
const AREA: Record<ImportEntity, AccessArea> = {
  pilots: "pilots",
  uavs: "fleet",
  batteries: "fleet",
  components: "fleet",
};

/** Inserted in batches: one statement per row would be thousands of round trips. */
const BATCH_SIZE = 200;

export type ImportOutcome = {
  error: string | null;
  imported: number;
  /** Rows the file offered that were already in the portal, by natural key. */
  skippedExisting: number;
};

export async function commitImport(
  entity: string,
  fileText: string,
  dateFormat?: DateFormat,
): Promise<ImportOutcome> {
  const schema = schemaFor(entity);
  if (!schema) {
    return { error: "That is not something the portal imports.", imported: 0, skippedExisting: 0 };
  }

  const access = await getAccess();
  if (!access) {
    return { error: "You are not signed in.", imported: 0, skippedExisting: 0 };
  }
  if (!access.canManage(AREA[entity as ImportEntity])) {
    return {
      error: `You do not have permission to add ${schema.label}.`,
      imported: 0,
      skippedExisting: 0,
    };
  }

  const parsed = parseImport(fileText, schema, dateFormat);
  if (parsed.error) return { error: parsed.error, imported: 0, skippedExisting: 0 };

  const ready = importableRows(parsed.rows);
  if (ready.length === 0) {
    return {
      error: "Nothing in that file could be imported. Fix the rows flagged below and try again.",
      imported: 0,
      skippedExisting: 0,
    };
  }

  const supabase = await createClient();

  // What is already here. Scoped by RLS to the caller's organisation, so an
  // aircraft with the same id at another operator is correctly invisible and
  // does not block this one.
  const { data: existingRows, error: existingError } = await supabase
    .from(schema.table)
    .select(schema.naturalKey);

  if (existingError) {
    return {
      error: safeErrorMessage(existingError, "import"),
      imported: 0,
      skippedExisting: 0,
    };
  }

  // The select column is chosen at runtime, so PostgREST cannot infer the row
  // shape; the column name is ours and comes from the schema.
  const existing = new Set(
    ((existingRows ?? []) as unknown as Record<string, unknown>[]).map((row) =>
      String(row[schema.naturalKey] ?? "").toLowerCase(),
    ),
  );

  // Skipped rather than updated. Overwriting an aircraft's record from a
  // spreadsheet would quietly discard hours, maintenance history and every
  // correction made since — a merge is a decision, not an import.
  const fresh = ready.filter(
    (row) => !existing.has(String(row.values[schema.naturalKey] ?? "").toLowerCase()),
  );
  const skippedExisting = ready.length - fresh.length;

  if (fresh.length === 0) {
    return {
      error: `Every row in that file is already in the portal. Nothing was changed.`,
      imported: 0,
      skippedExisting,
    };
  }

  let imported = 0;
  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    // Every value in a row was produced by coerce() against this schema's own
    // field list, so the shape matches the table by construction — but the
    // table is chosen at runtime and TypeScript cannot see that.
    const batch = fresh.slice(i, i + BATCH_SIZE).map((row) => row.values);
    const insertInto = supabase.from(schema.table).insert as unknown as (
      rows: Record<string, unknown>[],
    ) => PromiseLike<{ error: { message: string } | null }>;
    const { error } = await insertInto(batch);

    if (error) {
      // Earlier batches are already committed. Saying so plainly beats
      // implying nothing happened, because the person has to know whether to
      // re-run the whole file or only the rest of it.
      return {
        error:
          imported > 0
            ? `${imported} ${schema.label} were imported, then the import failed: ${safeErrorMessage(error, "import")} Re-run with the remaining rows.`
            : safeErrorMessage(error, "import"),
        imported,
        skippedExisting,
      };
    }
    imported += batch.length;
  }

  revalidatePath("/pilots");
  revalidatePath("/fleet");
  revalidatePath("/maintenance");
  revalidatePath("/");

  return { error: null, imported, skippedExisting };
}
