import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, Type, Upload } from "lucide-react";

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dataUrl: string) => void;
  title: string;
}

export function SignatureModal({ open, onOpenChange, onSave, title }: SignatureModalProps) {
  const [tab, setTab] = useState("draw");
  const [typedName, setTypedName] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Draw state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const resetAll = useCallback(() => {
    setTypedName("");
    setUploadPreview(null);
    setHasDrawn(false);
    setIsDrawing(false);
    // Delay canvas clear to wait for Radix portal mount
    setTimeout(() => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }, 50);
  }, []);

  useEffect(() => {
    if (open) resetAll();
  }, [open, resetAll]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setIsDrawing(true);
  };
  const doDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasDrawn(true);
  };
  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Type → canvas data URL
  const typeToDataUrl = (name: string): string => {
    const c = document.createElement("canvas");
    c.width = 560;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#000000";
    ctx.font = "italic 48px 'Brush Script MT', 'Segoe Script', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, c.width / 2, c.height / 2);
    return c.toDataURL("image/png");
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    let dataUrl: string | null = null;
    if (tab === "draw" && hasDrawn && canvasRef.current) {
      dataUrl = canvasRef.current.toDataURL("image/png");
    } else if (tab === "type" && typedName.trim()) {
      dataUrl = typeToDataUrl(typedName.trim());
    } else if (tab === "upload" && uploadPreview) {
      dataUrl = uploadPreview;
    }
    if (dataUrl) {
      onSave(dataUrl);
      onOpenChange(false);
    }
  };

  const canSave =
    (tab === "draw" && hasDrawn) ||
    (tab === "type" && typedName.trim().length > 0) ||
    (tab === "upload" && !!uploadPreview);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="draw" className="flex-1 gap-1.5"><Pen className="w-3.5 h-3.5" /> Draw</TabsTrigger>
            <TabsTrigger value="type" className="flex-1 gap-1.5"><Type className="w-3.5 h-3.5" /> Type</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="mt-3">
            <div className="relative rounded-lg border-2 border-dashed border-border bg-white overflow-hidden" style={{ minHeight: 120 }}>
              <canvas
                ref={canvasRef}
                width={560}
                height={160}
                className="w-full cursor-crosshair touch-none"
                style={{ aspectRatio: "560/160", display: "block", minHeight: 120 }}
                onMouseDown={startDraw}
                onMouseMove={doDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={doDraw}
                onTouchEnd={endDraw}
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-muted-foreground text-sm tracking-wider uppercase">Sign here</span>
                </div>
              )}
            </div>
            {hasDrawn && (
              <Button variant="ghost" size="sm" onClick={clearCanvas} className="mt-1 gap-1 text-xs">
                <Eraser className="w-3 h-3" /> Clear
              </Button>
            )}
          </TabsContent>

          <TabsContent value="type" className="mt-3 space-y-3">
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type your name"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              autoFocus
            />
            {typedName.trim() && (
              <div className="h-20 flex items-center justify-center rounded-lg border border-border bg-white">
                <span
                  className="text-4xl text-black"
                  style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontStyle: "italic" }}
                >
                  {typedName}
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-3 space-y-3">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleUpload}
              className="w-full text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium"
            />
            {uploadPreview && (
              <div className="rounded-lg border border-border overflow-hidden bg-white p-2">
                <img src={uploadPreview} alt="Signature" className="max-h-24 mx-auto object-contain" />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} disabled={!canSave} className="w-full mt-2">
          Save Signature
        </Button>
      </DialogContent>
    </Dialog>
  );
}
