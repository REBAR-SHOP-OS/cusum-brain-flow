// @vitest-environment node
/**
 * Regression: shop-floor realtime channels must append crypto.randomUUID()
 * to prevent collisions when the same hook mounts in multiple components
 * or under React StrictMode double-mount.
 *
 * Rule: mem://architecture/realtime/subscription-standards
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = [
  "src/hooks/useBendBatches.ts",
  "src/hooks/useBenderBatches.ts",
  "src/hooks/useCutPlans.ts",
  "src/hooks/useWasteBank.ts",
  "src/hooks/useClearanceData.ts",
  "src/hooks/useStationData.ts",
  "src/hooks/useProductionQueues.ts",
  "src/hooks/usePickupOrders.ts",
  "src/hooks/useBundles.ts",
  "src/hooks/useInventoryData.ts",
  "src/hooks/useReadyToShip.ts",
];

describe("shop-floor realtime channel UUIDs", () => {
  for (const rel of FILES) {
    it(`${rel} appends crypto.randomUUID() to every .channel() call`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      const channelCalls = src.match(/\.channel\(`[^`]+`\)/g) ?? [];
      expect(channelCalls.length).toBeGreaterThan(0);
      for (const call of channelCalls) {
        expect(
          call,
          `channel name in ${rel} must include crypto.randomUUID() suffix`,
        ).toMatch(/crypto\.randomUUID\(\)/);
      }
    });
  }

  it("useInventoryData does not use the 'global' fallback id", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/hooks/useInventoryData.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\|\|\s*"global"/);
  });
});
