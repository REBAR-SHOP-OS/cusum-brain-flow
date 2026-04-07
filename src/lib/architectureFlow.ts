import { LAYERS, type ArchLayer } from "@/lib/architectureGraphData";

export const ARCHITECTURE_LAYOUT = {
  layerGap: 220,
  nodeWidth: 130,
  nodeGap: 30,
  leftMargin: 40,
  topMargin: 40,
  centerRef: 2800,
  maxPerRow: 10,
} as const;

export type ArchitectureLayoutItem = {
  id: string;
  layer: ArchLayer;
  position?: { x: number; y: number };
};

export function matchesArchitectureQuery(label: string, hint: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return (
    label.toLowerCase().includes(normalized) ||
    hint.toLowerCase().includes(normalized)
  );
}

export function applyArchitectureLayout<T extends ArchitectureLayoutItem>(items: T[]): T[] {
  const positions = new Map<string, { x: number; y: number }>();
  let layerOffset = 0;

  for (const layer of LAYERS) {
    const layerItems = items.filter((item) => item.layer === layer.key);
    if (!layerItems.length) continue;

    const rowCount = Math.ceil(layerItems.length / ARCHITECTURE_LAYOUT.maxPerRow);

    for (let row = 0; row < rowCount; row += 1) {
      const rowItems = layerItems.slice(
        row * ARCHITECTURE_LAYOUT.maxPerRow,
        (row + 1) * ARCHITECTURE_LAYOUT.maxPerRow,
      );
      const totalWidth =
        rowItems.length * ARCHITECTURE_LAYOUT.nodeWidth +
        Math.max(0, rowItems.length - 1) * ARCHITECTURE_LAYOUT.nodeGap;
      const startX =
        ARCHITECTURE_LAYOUT.leftMargin +
        Math.max(0, (ARCHITECTURE_LAYOUT.centerRef - totalWidth) / 2);
      const y =
        ARCHITECTURE_LAYOUT.topMargin +
        layerOffset * ARCHITECTURE_LAYOUT.layerGap +
        row * (ARCHITECTURE_LAYOUT.layerGap * 0.55);

      rowItems.forEach((item, index) => {
        positions.set(item.id, {
          x: startX + index * (ARCHITECTURE_LAYOUT.nodeWidth + ARCHITECTURE_LAYOUT.nodeGap),
          y,
        });
      });
    }

    layerOffset += rowCount > 1 ? 2 : 1;
  }

  return items.map((item) => ({
    ...item,
    position: positions.get(item.id) ?? {
      x: ARCHITECTURE_LAYOUT.leftMargin,
      y: ARCHITECTURE_LAYOUT.topMargin,
    },
  }));
}
