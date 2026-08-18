import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Turns a database or storage error into something safe to show a user.
 *
 * Raw Postgres messages name constraints, tables and columns, and RLS
 * failures describe policy behaviour — none of which belongs in a toast. The
 * original is logged server-side so it stays debuggable.
 */
export function safeErrorMessage(
  error: PostgrestError | { message: string; code?: string | number },
  context: string,
): string {
  console.error(`[${context}]`, error);

  const code = "code" in error ? error.code : undefined;

  switch (code) {
    case "23505":
      return "That record already exists. Check for a duplicate ID.";
    case "23503":
      return "A linked record is missing. Refresh the page and try again.";
    case "23514":
    case "22P02":
      return "Some of those values aren't valid. Check the form and try again.";
    case "42501":
      return "You don't have permission to do that.";
    case "42P01":
      return "The database isn't set up yet. Contact your administrator.";
    default:
      return `Couldn't complete that ${context}. Try again, or contact your administrator if it keeps happening.`;
  }
}

/**
 * Validates a value against the enum values the database will accept, so a
 * bad payload is rejected here instead of surfacing a Postgres enum error.
 */
export function parseEnum<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = String(value ?? "");
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}
