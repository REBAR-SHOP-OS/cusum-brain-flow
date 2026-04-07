import { describe, expect, it } from "vitest";

import { ARCHITECTURE_LAYOUT, applyArchitectureLayout } from "@/lib/architectureFlow";

describe("applyArchitectureLayout", () => {
  it("pushes later layers down when an earlier layer wraps onto a second row", () => {
    const base = applyArchitectureLayout([
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `entry-${index}`,
        layer: "entry" as const,
      })),
      { id: "auth-1", layer: "auth" as const },
    ]);
    const wrapped = applyArchitectureLayout([
      ...Array.from({ length: 11 }, (_, index) => ({
        id: `entry-${index}`,
        layer: "entry" as const,
      })),
      { id: "auth-1", layer: "auth" as const },
    ]);

    const baseAuth = base.find((item) => item.id === "auth-1");
    const wrappedAuth = wrapped.find((item) => item.id === "auth-1");

    expect(baseAuth?.position?.y).toBe(ARCHITECTURE_LAYOUT.topMargin + ARCHITECTURE_LAYOUT.layerGap);
    expect(wrappedAuth?.position?.y).toBe(ARCHITECTURE_LAYOUT.topMargin + ARCHITECTURE_LAYOUT.layerGap * 2);
  });

  it("keeps a platform node centered regardless of auth-layer node count", () => {
    const platformOnly = applyArchitectureLayout([
      { id: "platform-1", layer: "platform" as const },
    ]);
    const mixed = applyArchitectureLayout([
      ...Array.from({ length: 12 }, (_, index) => ({
        id: `auth-${index}`,
        layer: "auth" as const,
      })),
      { id: "platform-1", layer: "platform" as const },
    ]);

    const basePlatform = platformOnly.find((item) => item.id === "platform-1");
    const mixedPlatform = mixed.find((item) => item.id === "platform-1");

    expect(mixedPlatform?.position?.x).toBe(basePlatform?.position?.x);
  });
});
