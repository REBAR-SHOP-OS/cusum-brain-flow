import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

const PAGE_SIZE = 1000;

/**
 * Fetches all rows from a Supabase query by paginating in batches of 1000.
 * Overcomes the PostgREST server-side row limit.
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => PostgrestFilterBuilder<any, any, any>
): Promise<T[]> {
  let all: T[] = [];
  let page = 0;
  let done = false;

  while (!done) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw error;
    const rows = (data || []) as T[];
    all = all.concat(rows);
    if (rows.length < PAGE_SIZE) done = true;
    page++;
  }

  return all;
}
