// @vitest-environment node
/**
 * Regression: shop-floor delete calls must include .select('id') so RLS-blocked
 * deletes surface as detectable failures instead of silent no-ops.
 *
 * Rule: mem://architecture/database/deletion-verification
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = [
  "src/pages/DeliveryOps.tsx",
  "src/pages/LoadingStation.tsx",
  "src/pages/PickupStation.tsx",
];

describe("shop-floor deletes use .select('id')", () => {
  for (const rel of FILES) {
    it(`${rel}: every .delete().eq() is followed by .select('id')`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      // Find each .delete().eq(...) and confirm .select("id") or .select('id') follows on the same chain (same line).
      const lines = src.split("\n");
      const offenders: string[] = [];
      lines.forEach((line, i) => {
        if (/\.delete\(\)\s*\.eq\(/.test(line) && !/\.select\(["']id["']\)/.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
      expect(offenders, `delete calls missing .select('id'):\n${offenders.join("\n")}`).toEqual([]);
    });
  }
});
