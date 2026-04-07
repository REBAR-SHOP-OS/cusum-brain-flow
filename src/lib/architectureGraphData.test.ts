// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ARCH_NODES, ARCH_EDGES, LAYERS } from "@/lib/architectureGraphData";

describe("architectureGraphData integrity", () => {
  it("has no duplicate node IDs", () => {
    const ids = ARCH_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate edge IDs", () => {
    const ids = ARCH_EDGES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all edge sources and targets reference valid node IDs", () => {
    const nodeIds = new Set(ARCH_NODES.map((n) => n.id));
    for (const edge of ARCH_EDGES) {
      expect(nodeIds.has(edge.source), `edge ${edge.id} source "${edge.source}" not found`).toBe(true);
      expect(nodeIds.has(edge.target), `edge ${edge.id} target "${edge.target}" not found`).toBe(true);
    }
  });

  it("all nodes have a valid layer key", () => {
    const validLayers = new Set(LAYERS.map((l) => l.key));
    for (const node of ARCH_NODES) {
      expect(validLayers.has(node.layer), `node ${node.id} has invalid layer "${node.layer}"`).toBe(true);
    }
  });
});
