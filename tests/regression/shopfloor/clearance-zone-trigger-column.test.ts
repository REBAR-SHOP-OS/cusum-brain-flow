// @vitest-environment node
// Regression: log_clearance_zone_assignment must insert into activity_events.metadata,
// NOT a non-existent "payload" column. Writing to "payload" aborts every Storage Zone
// assignment on the Clearance station with:
//   column "payload" of relation "activity_events" does not exist
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");

describe("log_clearance_zone_assignment trigger column", () => {
  it("never references the wrong 'payload' column in any migration", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const offending: string[] = [];
    for (const f of files) {
      const src = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
      if (!/log_clearance_zone_assignment/i.test(src)) continue;
      // Only flag when this function body inserts into activity_events with payload column
      if (/INTO\s+public\.activity_events[\s\S]{0,400}\bpayload\b/i.test(src)) {
        offending.push(f);
      }
    }
    expect(offending).toEqual([]);
  });
});
