import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize, Eye, EyeOff, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import AnnotationLegend from "./AnnotationLegend";

const ELEMENT_COLORS: Record<string, string> = {
  footing: "#3b82f6",
  column: "#ef4444",
  beam: "#22c55e",
  slab: "#f97316",
  wall: "#a855f7",
  pier: "#14b8a6",
  grade_beam: "#06b6d4",
  retaining_wall: "#8b5cf6",
  stair: "#ec4899",
  pool_slab: "#0ea5e9",
  pool_deck: "#84cc16",
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

interface RenderedPage {
  url: string;
  width: number;
  height: number;
  fileIndex: number;
  pageInFile: number;
}

export default function AnnotatedDrawingViewer({
  sourceFiles,
  items,
  selectedItemId,
  onItemSelect,
}: AnnotatedDrawingViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Render PDFs to images and collect image URLs
  useEffect(() => {
    if (!sourceFiles.length) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const pages: RenderedPage[] = [];

      for (let fi = 0; fi < sourceFiles.length; fi++) {
        const url = sourceFiles[fi];
        const lowerUrl = url.toLowerCase();
        const isPdf = lowerUrl.includes(".pdf");

        if (isPdf) {
          try {
            const pdfjsLib = await import("pdfjs-dist");
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

            const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
            const pdf = await loadingTask.promise;

            for (let p = 1; p <= pdf.numPages; p++) {
              if (cancelled) return;
              const page = await pdf.getPage(p);
              const scale = 2; // High res for zoom
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement("canvas");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext("2d")!;
              await page.render({ canvasContext: ctx, viewport }).promise;
              const dataUrl = canvas.toDataURL("image/png");
              pages.push({
                url: dataUrl,
                width: viewport.width,
                height: viewport.height,
                fileIndex: fi,
                pageInFile: p - 1,
              });
            }
          } catch (err) {
            console.error("PDF render error:", err);
            // Fallback: add as-is (will show broken image but at least shows something)
            pages.push({ url, width: 0, height: 0, fileIndex: fi, pageInFile: 0 });
          }
        } else {
          // Image file — use directly
          pages.push({ url, width: 0, height: 0, fileIndex: fi, pageInFile: 0 });
        }
      }

      if (!cancelled) {
        setRenderedPages(pages);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sourceFiles]);

  // Map items to rendered page index based on file index + page_index
  const getPageItemsForRenderedPage = (renderedIdx: number) => {
    const rp = renderedPages[renderedIdx];
    if (!rp) return [];
    return items.filter((i) => {
      const itemPageIndex = i.page_index ?? 0;
      // Find which rendered page this item maps to
      // page_index from AI = overall page across all files
      // We need to check if this rendered page corresponds to that page_index
      return itemPageIndex === renderedIdx && i.bbox && !hiddenTypes.has(i.element_type?.toLowerCase());
    });
  };

  const pageItems = getPageItemsForRenderedPage(currentPage);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => Math.min(4, Math.max(0.5, z + delta)));
  }, []);

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

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const fitToWidth = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const toggleType = (type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Rendering drawings...
      </div>
    );
  }

  if (!renderedPages.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No drawings uploaded for this project.
      </div>
    );
  }

  const currentUrl = renderedPages[currentPage]?.url;

  return (
    <div className="flex gap-3">
      <AnnotationLegend items={items} hiddenTypes={hiddenTypes} onToggleType={toggleType} colors={ELEMENT_COLORS} />

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
          <Button size="sm" variant={showAnnotations ? "default" : "outline"} onClick={() => setShowAnnotations(!showAnnotations)}>
            {showAnnotations ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {showAnnotations ? "On" : "Off"}
          </Button>
          <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>

          {renderedPages.length > 1 && (
            <div className="flex items-center gap-1 ml-auto">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setCurrentPage((p) => Math.max(0, p - 1)); fitToWidth(); }} disabled={currentPage === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-1">
                Page {currentPage + 1} / {renderedPages.length}
              </span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setCurrentPage((p) => Math.min(renderedPages.length - 1, p + 1)); fitToWidth(); }} disabled={currentPage >= renderedPages.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
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
              alt={`Drawing page ${currentPage + 1}`}
              className="max-w-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              style={{ display: "block" }}
            />

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
                        <rect
                          x={x} y={y} width={w} height={h}
                          fill={color}
                          fillOpacity={isSelected ? 0.35 : isHovered ? 0.25 : 0.12}
                          stroke={color}
                          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                          rx={3}
                          onClick={(e) => { e.stopPropagation(); onItemSelect(item.id === selectedItemId ? null : item.id); }}
                          onMouseEnter={() => setHoveredId(item.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        />
                        <rect x={x} y={y - 18} width={Math.max(w, 90)} height={16} fill={color} rx={2} />
                        <text x={x + 3} y={y - 5} fill="white" fontSize={11} fontWeight="bold" fontFamily="sans-serif">
                          {item.element_ref || item.mark} – {item.bar_size} x{item.quantity}
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
