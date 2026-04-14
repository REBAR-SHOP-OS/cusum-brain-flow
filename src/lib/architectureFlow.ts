import { LAYERS, type ArchLayer } from "@/lib/architectureGraphData";

export const ARCHITECTURE_LAYOUT = {
  layerGap: 280,
  nodeWidth: 130,
  nodeHeight: 72,
  nodeGap: 16,
  leftMargin: 40,
  topMargin: 40,
  maxPerColumn: 14,
} as const;

export type ArchitectureLayoutItem = {
  id: string;
  layer?: ArchLayer;
  data?: { layer?: ArchLayer };
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

function resolveLayer(item: ArchitectureLayoutItem): ArchLayer | undefined {
  return item.layer || item.data?.layer;
}

/**
 * Horizontal layout: each layer is a column (left → right).
 * Nodes within a column stack vertically.
 * If a column has more than maxPerColumn nodes, it wraps into multiple sub-columns.
 */
export function applyArchitectureLayout<T extends ArchitectureLayoutItem>(items: T[]): (T & { position: { x: number; y: number } })[] {
  const positions = new Map<string, { x: number; y: number }>();
  let columnOffset = 0;

  for (const layer of LAYERS) {
    const layerItems = items.filter((item) => resolveLayer(item) === layer.key);
    if (!layerItems.length) continue;

    const colCount = Math.ceil(layerItems.length / ARCHITECTURE_LAYOUT.maxPerColumn);

    for (let col = 0; col < colCount; col += 1) {
      const colItems = layerItems.slice(
        col * ARCHITECTURE_LAYOUT.maxPerColumn,
        (col + 1) * ARCHITECTURE_LAYOUT.maxPerColumn,
      );

      const x =
        ARCHITECTURE_LAYOUT.leftMargin +
        (columnOffset + col) * ARCHITECTURE_LAYOUT.layerGap;

      colItems.forEach((item, index) => {
        positions.set(item.id, {
          x,
          y: ARCHITECTURE_LAYOUT.topMargin + index * (ARCHITECTURE_LAYOUT.nodeHeight + ARCHITECTURE_LAYOUT.nodeGap),
        });
      });
    }

    columnOffset += colCount;
  }

  return items.map((item) => ({
    ...item,
    position: positions.get(item.id) ?? {
      x: ARCHITECTURE_LAYOUT.leftMargin,
      y: ARCHITECTURE_LAYOUT.topMargin,
    },
  }));
}
