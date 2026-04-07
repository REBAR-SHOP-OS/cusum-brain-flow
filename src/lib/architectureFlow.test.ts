// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ARCHITECTURE_LAYOUT, applyArchitectureLayout, matchesArchitectureQuery } from "@/lib/architectureFlow";
import type { ArchitectureLayoutItem } from "@/lib/architectureFlow";

describe("applyArchitectureLayout", () => {
  it("pushes later layers down when an earlier layer wraps onto a second row", () => {
    const base = applyArchitectureLayout(
      [
        ...Array.from({ length: 10 }, (_, index): ArchitectureLayoutItem => ({
          id: `entry-${index}`,
          layer: "entry",
        })),
        { id: "auth-1", layer: "auth" } as ArchitectureLayoutItem,
      ],
    );
    const wrapped = applyArchitectureLayout(
      [
        ...Array.from({ length: 11 }, (_, index): ArchitectureLayoutItem => ({
          id: `entry-${index}`,
          layer: "entry",
        })),
        { id: "auth-1", layer: "auth" } as ArchitectureLayoutItem,
      ],
    );

    const baseAuth = base.find((item) => item.id === "auth-1")!;
    const wrappedAuth = wrapped.find((item) => item.id === "auth-1")!;

    expect(baseAuth.position.y).toBe(ARCHITECTURE_LAYOUT.topMargin + ARCHITECTURE_LAYOUT.layerGap);
    expect(wrappedAuth.position.y).toBe(ARCHITECTURE_LAYOUT.topMargin + ARCHITECTURE_LAYOUT.layerGap * 2);
  });

  it("keeps a platform node centered regardless of auth-layer node count", () => {
    const platformOnly = applyArchitectureLayout([
      { id: "platform-1", layer: "platform" } as ArchitectureLayoutItem,
    ]);
    const mixed = applyArchitectureLayout([
      ...Array.from({ length: 12 }, (_, index): ArchitectureLayoutItem => ({
        id: `auth-${index}`,
        layer: "auth",
      })),
      { id: "platform-1", layer: "platform" } as ArchitectureLayoutItem,
    ]);

    const basePlatform = platformOnly.find((item) => item.id === "platform-1")!;
    const mixedPlatform = mixed.find((item) => item.id === "platform-1")!;

    expect(mixedPlatform.position.x).toBe(basePlatform.position.x);
  });

  it("resolves layer from data.layer fallback (React Flow format)", () => {
    const items: ArchitectureLayoutItem[] = [
      { id: "top-level", layer: "entry" },
      { id: "nested", data: { layer: "entry" } },
    ];
    const result = applyArchitectureLayout(items);
    const topLevel = result.find((i) => i.id === "top-level")!;
    const nested = result.find((i) => i.id === "nested")!;

    expect(nested.position.y).toBe(topLevel.position.y);
  });

  it("wraps 25+ nodes into 3 rows with increasing y", () => {
    const items: ArchitectureLayoutItem[] = Array.from({ length: 25 }, (_, i) => ({
      id: `p-${i}`,
      layer: "platform" as const,
    }));
    const result = applyArchitectureLayout(items);
    const row1 = result.find((i) => i.id === "p-0")!;
    const row2 = result.find((i) => i.id === "p-10")!;
    const row3 = result.find((i) => i.id === "p-20")!;

    expect(row2.position.y).toBeGreaterThan(row1.position.y);
    expect(row3.position.y).toBeGreaterThan(row2.position.y);
  });
});

describe("matchesArchitectureQuery", () => {
  it("returns true for empty query", () => {
    expect(matchesArchitectureQuery("Vizzy", "AI Agent", "")).toBe(true);
  });

  it("matches on label", () => {
    expect(matchesArchitectureQuery("Vizzy", "AI Agent", "vizzy")).toBe(true);
  });

  it("matches on hint", () => {
    expect(matchesArchitectureQuery("Vizzy", "AI Agent", "agent")).toBe(true);
  });

  it("returns false on no match", () => {
    expect(matchesArchitectureQuery("Vizzy", "AI Agent", "stripe")).toBe(false);
  });
});
