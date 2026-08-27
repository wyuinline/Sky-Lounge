/**
 * Shared constants for the manual editor.
 *
 * Kept out of manual-actions.ts because a "use server" module may only export
 * async functions — a plain constant there is a build error.
 */

/** No parent chosen: the section sits at the top level of the manual. */
export const TOP_LEVEL = "__top__";

/** No document chosen: the section carries its own text instead. */
export const NO_DOCUMENT = "__none__";
