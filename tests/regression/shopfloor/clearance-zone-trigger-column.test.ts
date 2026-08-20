// @vitest-environment node
// Regression: log_clearance_zone_assignment must insert into activity_events.metadata,
// NOT a non-existent "payload" column. Writing to "payload" aborts every Storage Zone
// assignment on the Clearance station with:
//   column "payload" of relation "activity_events" does not exist
//
// Historical migrations may contain the buggy version; what matters is that the
// LATEST migration that (re)defines this function uses the correct column.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");

describe("log_clearance_zone_assignment trigger column", () => {
  it("latest migration defining the function uses metadata, not payload", () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const touching = files.filter((f) =>
      /log_clearance_zone_assignment/i.test(
        readFileSync(resolve(MIGRATIONS_DIR, f), "utf8"),
      ),
    );
    expect(touching.length).toBeGreaterThan(0);
    const latest = touching[touching.length - 1];
    const src = readFileSync(resolve(MIGRATIONS_DIR, latest), "utf8");
    // Extract the function body region around activity_events insert
    const insertRegion = src.match(
      /INTO\s+public\.activity_events[\s\S]{0,600}/i,
    );
    expect(insertRegion).not.toBeNull();
    expect(insertRegion![0]).toMatch(/\bmetadata\b/);
    expect(insertRegion![0]).not.toMatch(/\bpayload\b/);
  });
});
