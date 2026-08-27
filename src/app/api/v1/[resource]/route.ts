import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateKey } from "@/lib/api-auth";
import { findResource } from "@/lib/api-resources";
import { parsePageSize, parseOffset } from "@/lib/api-keys";
import { toCsv, type CsvValue } from "@/lib/csv";

/**
 * The read API.
 *
 * One route for every resource, driven by the table in api-resources.ts. It
 * serves JSON by default and CSV on request, because half the things that will
 * consume this are spreadsheets.
 *
 * The service-role client is used deliberately: an API key is not a person, so
 * there is no session for RLS to key off. The scope check above and the
 * explicit column list below are what stand in for it — which is why neither
 * may ever be loosened to a wildcard.
 */

export const dynamic = "force-dynamic";

/** Flattens embedded relations so a CSV has one column per field. */
function flatten(row: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const name = prefix ? `${prefix}_${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, name));
    } else if (Array.isArray(value)) {
      out[name] = value.join("; ");
    } else {
      out[name] = value;
    }
  }
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const { resource: name } = await params;
  const resource = findResource(name);
  if (resource === null) {
    return NextResponse.json(
      { error: `Unknown resource "${name}". GET /api/v1 lists what is available.` },
      { status: 404 },
    );
  }

  const auth = await authenticateKey(request, resource.scope);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const url = request.nextUrl;
  const limit = parsePageSize(url.searchParams.get("limit"));
  const offset = parseOffset(url.searchParams.get("offset"));

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "The API is not configured." }, { status: 500 });
  }

  // supabase-js overloads .from() separately for tables and for views, so a
  // union of both matches neither. ApiSource still ties every resource to the
  // generated schema — a renamed view breaks api-resources.ts — and this cast
  // only bridges the two overloads.
  const from = supabase.from as (relation: string) => ReturnType<typeof supabase.from>;

  let query = from(resource.from)
    .select(resource.select, { count: "exact" })
    .order(resource.orderBy, { ascending: resource.ascending, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (resource.exclude) {
    query = query.not(
      resource.exclude.column,
      "in",
      `(${resource.exclude.values.join(",")})`,
    );
  }

  if (resource.dateColumn) {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    // Bad dates are refused rather than ignored: silently returning everything
    // when someone meant to narrow it is the wrong kind of helpful.
    if (from !== null) {
      if (Number.isNaN(Date.parse(from))) {
        return NextResponse.json({ error: `"from" is not a date: ${from}` }, { status: 400 });
      }
      query = query.gte(resource.dateColumn, from);
    }
    if (to !== null) {
      if (Number.isNaN(Date.parse(to))) {
        return NextResponse.json({ error: `"to" is not a date: ${to}` }, { status: 400 });
      }
      query = query.lte(resource.dateColumn, to);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    // The caller gets the shape of the problem, not the database's wording.
    console.error(`[api] ${name} query failed`, error);
    return NextResponse.json({ error: "That query could not be run." }, { status: 500 });
  }

  // The select string is built at runtime, so PostgREST cannot infer the row
  // shape. flatten() only reads keys, and the column list is ours.
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => flatten(row));

  if (url.searchParams.get("format") === "csv") {
    // Column order comes from the first row, which PostgREST returns in the
    // order of the select string — so the CSV matches the documented shape.
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return new NextResponse(
      toCsv(
        columns,
        rows.map((row) => columns.map((c) => row[c] as CsvValue)),
      ),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name}.csv"`,
        },
      },
    );
  }

  return NextResponse.json({
    data: rows,
    paging: {
      limit,
      offset,
      count: count ?? rows.length,
      // Saves the caller doing the arithmetic wrong.
      next: count !== null && offset + limit < count ? offset + limit : null,
    },
  });
}
