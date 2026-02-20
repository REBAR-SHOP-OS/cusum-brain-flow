import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AnnotationLegend from "./AnnotationLegend";

const ELEMENT_COLORS: Record<string, string> = {
  footing: "#3b82f6",   // blue
  column: "#ef4444",    // red
  beam: "#22c55e",      // green
  slab: "#f97316",      // orange
  wall: "#a855f7",      // purple
  pier: "#14b8a6",      // teal
};

function getColor(type: string) {
  return ELEMENT_COLORS[type?.toLowerCase()] ?? "#6b7280";
}

interface AnnotatedDrawingViewerProps {
  sourceFiles: string[];
  items: any[];
  selectedItemId: string | null;
  onItemSelect: (id: string | null) => void;
}

export default function AnnotatedDrawingViewer({
  sourceFiles,
  items,
  selectedItemId,
  onItemSelect,
}: AnnotatedDrawingViewerProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const pageItems = items.filter(
    (i) => (i.page_index ?? 0) === pageIndex && i.bbox && !hiddenTypes.has(i.element_type?.toLowerCase())
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setZoom((z) => Math.min(4, Math.max(0.5, z + delta)));
    },
    []
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan((p) => ({
      x: p.x + (e.clientX - lastMouse.current.x),
      y: p.y + (e.clientY - lastMouse.current.y),
    }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const fitToWidth = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const currentUrl = sourceFiles[pageIndex];
  if (!currentUrl) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No drawings uploaded for this project.
      </div>
    );
  }

  const toggleType = (type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="flex gap-3">
      {/* Legend sidebar */}
      <AnnotationLegend
        items={items}
        hiddenTypes={hiddenTypes}
        onToggleType={toggleType}
        colors={ELEMENT_COLORS}
      />

      {/* Main viewer */}
      <div className="flex-1 space-y-2">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={fitToWidth}>
            <Maximize className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={showAnnotations ? "default" : "outline"}
            onClick={() => setShowAnnotations(!showAnnotations)}
          >
            {showAnnotations ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {showAnnotations ? "Annotations On" : "Annotations Off"}
          </Button>
          <span className="text-xs text-muted-foreground ml-2">{Math.round(zoom * 100)}%</span>

          {sourceFiles.length > 1 && (
            <div className="flex items-center gap-1 ml-auto">
              {sourceFiles.map((_, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={i === pageIndex ? "default" : "outline"}
                  onClick={() => { setPageIndex(i); fitToWidth(); }}
                  className="h-7 w-7 p-0 text-xs"
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Drawing area */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg border bg-muted/30 cursor-grab active:cursor-grabbing"
          style={{ height: "calc(100vh - 320px)", minHeight: 400 }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "top left",
              position: "relative",
              display: "inline-block",
            }}
          >
            <img
              src={currentUrl}
              alt={`Drawing page ${pageIndex + 1}`}
              className="max-w-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              style={{ display: "block" }}
            />

            {/* SVG overlay */}
            {showAnnotations && imgSize.w > 0 && (
              <TooltipProvider delayDuration={100}>
                <svg
                  width={imgSize.w}
                  height={imgSize.h}
                  style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
                  viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
                >
                  {pageItems.map((item) => {
                    const bbox = item.bbox;
                    if (!bbox) return null;
                    const x = bbox.x * imgSize.w;
                    const y = bbox.y * imgSize.h;
                    const w = bbox.w * imgSize.w;
                    const h = bbox.h * imgSize.h;
                    const color = getColor(item.element_type);
                    const isSelected = item.id === selectedItemId;
                    const isHovered = item.id === hoveredId;

                    return (
                      <g key={item.id} style={{ pointerEvents: "all", cursor: "pointer" }}>
                        {/* Background fill */}
                        <rect
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                          fill={color}
                          fillOpacity={isSelected ? 0.35 : isHovered ? 0.25 : 0.12}
                          stroke={color}
                          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                          strokeDasharray={isSelected ? "none" : "none"}
                          rx={3}
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemSelect(item.id === selectedItemId ? null : item.id);
                          }}
                          onMouseEnter={() => setHoveredId(item.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        />
                        {/* Label */}
                        <rect
                          x={x}
                          y={y - 18}
                          width={Math.max(w, 90)}
                          height={16}
                          fill={color}
                          rx={2}
                        />
                        <text
                          x={x + 3}
                          y={y - 5}
                          fill="white"
                          fontSize={11}
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {item.element_ref} – {item.bar_size} x{item.quantity}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </TooltipProvider>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Scroll to zoom • Drag to pan • Click annotations to highlight in BOM
        </p>
      </div>
    </div>
  );
}
