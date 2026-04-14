// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ARCHITECTURE_LAYOUT, applyArchitectureLayout, matchesArchitectureQuery } from "@/lib/architectureFlow";
import type { ArchitectureLayoutItem } from "@/lib/architectureFlow";

describe("applyArchitectureLayout", () => {
  it("pushes later layers down when an earlier layer wraps onto a second row", () => {
    const base = applyArchitectureLayout(
      [
        ...Array.from({ length: 14 }, (_, index): ArchitectureLayoutItem => ({
          id: `ai-${index}`,
          layer: "ai",
        })),
        { id: "mod-1", layer: "modules" } as ArchitectureLayoutItem,
      ],
    );
    const wrapped = applyArchitectureLayout(
      [
        ...Array.from({ length: 15 }, (_, index): ArchitectureLayoutItem => ({
          id: `ai-${index}`,
          layer: "ai",
        })),
        { id: "mod-1", layer: "modules" } as ArchitectureLayoutItem,
      ],
    );

    const baseMod = base.find((item) => item.id === "mod-1")!;
    const wrappedMod = wrapped.find((item) => item.id === "mod-1")!;

    expect(baseMod.position.y).toBe(ARCHITECTURE_LAYOUT.topMargin + ARCHITECTURE_LAYOUT.layerGap);
    expect(wrappedMod.position.y).toBe(ARCHITECTURE_LAYOUT.topMargin + ARCHITECTURE_LAYOUT.layerGap * 2);
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

  it("wraps 29+ nodes into 3 rows with increasing y", () => {
    const items: ArchitectureLayoutItem[] = Array.from({ length: 29 }, (_, i) => ({
      id: `p-${i}`,
      layer: "platform" as const,
    }));
    const result = applyArchitectureLayout(items);
    const row1 = result.find((i) => i.id === "p-0")!;
    const row2 = result.find((i) => i.id === "p-14")!;
    const row3 = result.find((i) => i.id === "p-28")!;

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
