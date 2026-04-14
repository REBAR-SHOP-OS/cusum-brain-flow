import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export type LayerHeaderNodeData = {
  label: string;
  accentColor: string;
};

function LayerHeaderNodeInner({ data }: NodeProps) {
  const nodeData = data as unknown as LayerHeaderNodeData;

  return (
    <div
      style={{
        padding: "6px 18px",
        borderBottom: `2px solid ${nodeData.accentColor}`,
        background: "rgba(5,10,20,0.7)",
        backdropFilter: "blur(8px)",
        borderRadius: "6px 6px 0 0",
        pointerEvents: "none",
        userSelect: "none",
        textAlign: "center",
        minWidth: 120,
      }}
    >
      <span
        style={{
          color: nodeData.accentColor,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {nodeData.label}
      </span>
    </div>
  );
}

export const LayerHeaderNode = memo(LayerHeaderNodeInner);
