// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * HARD rule (mem://rules/frontend-development-standards):
 * React.lazy is forbidden in pages that render <Tabs ...> — lazy tab children
 * dispatch-crash on re-mount under React 18 concurrent rendering.
 *
 * This test scans every src/pages/*.tsx file that contains <Tabs and asserts
 * none of them import or call lazy/React.lazy.
 */

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("no React.lazy in tab pages", () => {
  const pageFiles = walk("src/pages");

  for (const file of pageFiles) {
    const src = readFileSync(file, "utf8");
    const hasTabs = /<Tabs[\s>]/.test(src);
    if (!hasTabs) continue;

    it(`${file} (uses <Tabs>) must not use React.lazy`, () => {
      expect(/\blazy\s*\(/.test(src), `${file} contains lazy(...)`).toBe(false);
      expect(/React\.lazy/.test(src), `${file} contains React.lazy`).toBe(false);
    });
  }
});
