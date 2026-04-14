import { LAYERS, type ArchLayer, type Accent } from "@/lib/architectureGraphData";

export const ARCHITECTURE_LAYOUT = {
  nodeWidth: 190,
  nodeHeight: 120,
  nodeGap: 18,
  leftMargin: 40,
  topMargin: 80,
  layerHeaderHeight: 50,
  layerGroupGap: 40,
  // kept for compatibility but unused in vertical layout
  layerGap: 340,
  maxPerColumn: 14,
  headerY: 0,
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
 * Vertical single-column layout: all nodes stack top-to-bottom,
 * grouped by layer with a gap between groups.
 */
export function applyArchitectureLayout<T extends ArchitectureLayoutItem>(items: T[]): (T & { position: { x: number; y: number } })[] {
  const positions = new Map<string, { x: number; y: number }>();
  const x = ARCHITECTURE_LAYOUT.leftMargin;
  let y = ARCHITECTURE_LAYOUT.topMargin;

  for (const layer of LAYERS) {
    const layerItems = items.filter((item) => resolveLayer(item) === layer.key);
    if (!layerItems.length) continue;

    // Skip space for the header
    y += ARCHITECTURE_LAYOUT.layerHeaderHeight;

    layerItems.forEach((item, index) => {
      positions.set(item.id, { x, y });
      y += ARCHITECTURE_LAYOUT.nodeHeight + ARCHITECTURE_LAYOUT.nodeGap;
    });

    y += ARCHITECTURE_LAYOUT.layerGroupGap;
  }

  return items.map((item) => ({
    ...item,
    position: positions.get(item.id) ?? { x, y: ARCHITECTURE_LAYOUT.topMargin },
  }));
}

/**
 * Generate header nodes for each layer group (vertical layout).
 */
export type LayerHeaderInfo = {
  id: string;
  label: string;
  accent: Accent;
  position: { x: number; y: number };
  colSpan: number;
};

export function generateLayerHeaders<T extends ArchitectureLayoutItem>(items: T[]): LayerHeaderInfo[] {
  const headers: LayerHeaderInfo[] = [];
  const x = ARCHITECTURE_LAYOUT.leftMargin;
  let y = ARCHITECTURE_LAYOUT.topMargin;

  for (const layer of LAYERS) {
    const layerItems = items.filter((item) => resolveLayer(item) === layer.key);
    if (!layerItems.length) continue;

    headers.push({
      id: `header-${layer.key}`,
      label: layer.label,
      accent: layer.accent,
      position: { x, y },
      colSpan: 1,
    });

    y += ARCHITECTURE_LAYOUT.layerHeaderHeight;
    y += layerItems.length * (ARCHITECTURE_LAYOUT.nodeHeight + ARCHITECTURE_LAYOUT.nodeGap);
    y += ARCHITECTURE_LAYOUT.layerGroupGap;
  }

  return headers;
}
