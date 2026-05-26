/**
 * REGRESSION: Every SSH deploy must call `scripts/purge-cache.sh`, which
 * writes `.deploy/purge-log.json` with timestamp + commit SHA.
 *
 * This test verifies the purge script + verifier wiring exists. If a deploy
 * log is present, it also asserts the schema is valid. Missing log is NOT
 * a failure (fresh checkout / no deploys yet) — but a malformed log IS.
 *
 * Related: mem://~user (always purge site cache after every SSH deployment)
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const PURGE_SCRIPT = resolve(ROOT, "scripts/purge-cache.sh");
const VERIFIER = resolve(ROOT, "scripts/verify-cache-purge-wired.sh");
const LOG_PATH = resolve(ROOT, ".deploy/purge-log.json");

describe("cache: deploy-purge wiring", () => {
  it("scripts/purge-cache.sh exists", () => {
    expect(existsSync(PURGE_SCRIPT)).toBe(true);
  });

  it("scripts/purge-cache.sh is non-empty", () => {
    expect(statSync(PURGE_SCRIPT).size).toBeGreaterThan(100);
  });

  it("scripts/verify-cache-purge-wired.sh exists", () => {
    expect(existsSync(VERIFIER)).toBe(true);
  });

  it("if .deploy/purge-log.json exists, it has timestamp + commit", () => {
    if (!existsSync(LOG_PATH)) return; // no deploys yet — pass
    const log = JSON.parse(readFileSync(LOG_PATH, "utf-8"));
    expect(Array.isArray(log) || typeof log === "object").toBe(true);
    const last = Array.isArray(log) ? log[log.length - 1] : log;
    expect(last).toHaveProperty("timestamp");
    expect(last).toHaveProperty("commit");
  });
});
