import { cn } from "@/lib/utils";

interface AsaShapeDiagramProps {
  shapeCode: string;
  dimensions?: Record<string, number> | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

// SVG paths for common ASA rebar bend shapes
const SHAPE_PATHS: Record<string, { path: string; labels: { key: string; x: number; y: number }[] }> = {
  // Shape 1: Straight bar
  "1": {
    path: "M 20,100 L 280,100",
    labels: [{ key: "A", x: 150, y: 85 }],
  },
  // Shape 3: L-shape (90° hook one end)
  "3": {
    path: "M 20,40 L 20,140 L 200,140",
    labels: [
      { key: "A", x: 110, y: 155 },
      { key: "B", x: 5, y: 90 },
    ],
  },
  // Shape 5: U-shape (180° hook)
  "5": {
    path: "M 20,40 L 20,140 L 200,140 L 200,40",
    labels: [
      { key: "A", x: 110, y: 155 },
      { key: "B", x: 5, y: 90 },
      { key: "C", x: 210, y: 90 },
    ],
  },
  // Shape 11: Z-shape (crank)
  "11": {
    path: "M 20,50 L 120,50 L 180,150 L 280,150",
    labels: [
      { key: "A", x: 70, y: 35 },
      { key: "B", x: 155, y: 100 },
      { key: "C", x: 230, y: 165 },
    ],
  },
  // Shape 17: Stirrup (closed rectangle)
  "17": {
    path: "M 60,30 L 240,30 L 240,170 L 60,170 L 60,30 L 60,10",
    labels: [
      { key: "A", x: 150, y: 18 },
      { key: "B", x: 255, y: 100 },
      { key: "C", x: 150, y: 185 },
      { key: "D", x: 45, y: 100 },
    ],
  },
  // Shape 21: Complex shape with multiple bends
  "21": {
    path: "M 20,30 L 20,170 L 140,170 L 140,80 L 280,80",
    labels: [
      { key: "A", x: 5, y: 100 },
      { key: "B", x: 80, y: 185 },
      { key: "C", x: 155, y: 125 },
      { key: "D", x: 210, y: 68 },
    ],
  },
  // Shape 31: Hook shape
  "31": {
    path: "M 20,100 L 180,100 L 180,40",
    labels: [
      { key: "A", x: 100, y: 115 },
      { key: "B", x: 195, y: 70 },
    ],
  },
  // Shape 33: Double hook
  "33": {
    path: "M 20,40 L 20,100 L 220,100 L 220,40",
    labels: [
      { key: "A", x: 5, y: 70 },
      { key: "B", x: 120, y: 115 },
      { key: "C", x: 235, y: 70 },
    ],
  },
  // Shape 41: Spiral / helical
  "41": {
    path: "M 40,160 L 40,40 L 260,40 L 260,160 L 40,160",
    labels: [
      { key: "A", x: 150, y: 25 },
      { key: "B", x: 275, y: 100 },
      { key: "H", x: 25, y: 100 },
    ],
  },
  // Shape 51: Cranked bar
  "51": {
    path: "M 20,140 L 80,140 L 120,60 L 220,60 L 260,140 L 280,140",
    labels: [
      { key: "A", x: 50, y: 155 },
      { key: "B", x: 100, y: 100 },
      { key: "C", x: 170, y: 48 },
      { key: "D", x: 240, y: 100 },
    ],
  },
};

const sizeMap = {
  sm: { width: 120, height: 80, scale: 0.38 },
  md: { width: 200, height: 130, scale: 0.62 },
  lg: { width: 300, height: 200, scale: 1 },
};

export function AsaShapeDiagram({ shapeCode, dimensions, className, size = "lg" }: AsaShapeDiagramProps) {
  const shape = SHAPE_PATHS[shapeCode];
  const { width, height, scale } = sizeMap[size];

  if (!shape) {
    // Fallback: show shape number in a circle
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="relative flex items-center justify-center">
          <svg width={width} height={height} viewBox="0 0 300 200">
            <circle cx="150" cy="100" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />
            <text x="150" y="108" textAnchor="middle" fill="hsl(var(--primary))" fontSize="28" fontWeight="bold">
              {shapeCode}
            </text>
            <text x="150" y="175" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12">
              ASA SHAPE
            </text>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <svg width={width} height={height} viewBox="0 0 300 200">
        {/* Shape outline */}
        <path
          d={shape.path}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={3 / scale}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Shape number circle */}
        <circle cx="150" cy="100" r={22} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
        <text x="150" y="106" textAnchor="middle" fill="hsl(var(--primary))" fontSize="14" fontWeight="bold">
          {shapeCode}
        </text>

        {/* Dimension labels */}
        {shape.labels.map((label) => {
          const value = dimensions?.[label.key];
          return (
            <g key={label.key}>
              <circle cx={label.x} cy={label.y} r={12} fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
              <text x={label.x} y={label.y + 4} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="10" fontWeight="600">
                {label.key}
              </text>
              {value !== undefined && (
                <text x={label.x} y={label.y + 22} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">
                  {value}mm
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
