import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Loader2, Undo2, Trash2, Send, Check, RotateCcw, ImagePlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

interface Stroke {
  points: { x: number; y: number }[];
  size: number;
}

interface ImageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onImageReady: (url: string) => void;
}

export function ImageEditDialog({ open, onOpenChange, imageUrl, onImageReady }: ImageEditDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [brushSize, setBrushSize] = useState(20);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load image when dialog opens
  useEffect(() => {
    if (!open || !imageUrl) return;
    setStrokes([]);
    setPrompt("");
    setPreviewUrl(null);
    setReferenceImage(null);
    setImgLoaded(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => {
      toast({ title: "Could not load image", variant: "destructive" });
    };
    img.src = imageUrl;
  }, [open, imageUrl]);

  // Redraw canvas whenever strokes change
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;

    // Fit image into max 600x600 display
    const maxW = 600;
    const maxH = 600;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw all strokes as red semi-transparent
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = "rgba(255, 0, 0, 0.45)";
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [imgLoaded, strokes, currentStroke, previewUrl]);

  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);
    setCurrentStroke({ points: [pos], size: brushSize });
  }, [brushSize, getCanvasPos]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!currentStroke) return;
    const pos = getCanvasPos(e);
    setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos] } : null);
  }, [currentStroke, getCanvasPos]);

  const onPointerUp = useCallback(() => {
    if (currentStroke && currentStroke.points.length > 1) {
      setStrokes(prev => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  }, [currentStroke]);

  const handleUndo = () => setStrokes(prev => prev.slice(0, -1));
  const handleClear = () => setStrokes([]);

  const handleApply = async () => {
    if (!prompt.trim()) {
      toast({ title: "Enter a prompt", description: "Describe what you want to change.", variant: "destructive" });
      return;
    }
    if (!canvasRef.current || !imgRef.current) return;

    setLoading(true);
    try {
      // Get the composite image (image + red marks) as base64
      const compositeBase64 = canvasRef.current.toDataURL("image/png");

      // Generate a clean original image (no red strokes) for the AI to use as base
      const cleanCanvas = document.createElement("canvas");
      const img = imgRef.current;
      cleanCanvas.width = canvasRef.current.width;
      cleanCanvas.height = canvasRef.current.height;
      const cleanCtx = cleanCanvas.getContext("2d")!;
      cleanCtx.drawImage(img, 0, 0, cleanCanvas.width, cleanCanvas.height);
      const originalBase64 = cleanCanvas.toDataURL("image/png");

      const data = await invokeEdgeFunction<{ imageUrl: string }>("generate-image", {
        prompt: prompt.trim(),
        editImage: compositeBase64,
        originalImage: originalBase64,
        model: "google/gemini-3.1-flash-image-preview",
        ...(referenceImage ? { referenceImage } : {}),
      }, { timeoutMs: 120000, retries: 1 });

      if (data.imageUrl) {
        setPreviewUrl(data.imageUrl);
      } else {
        throw new Error("No image returned");
      }
    } catch (err: any) {
      toast({ title: "Edit failed", description: err?.message || "Could not edit image", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Image with AI</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {previewUrl ? (
            <>
              {/* Preview of edited image */}
              <div className="flex justify-center bg-muted rounded-lg p-2">
                <img src={previewUrl} alt="Edited preview" className="rounded max-w-full max-h-[500px] object-contain" />
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setPreviewUrl(null)}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Retry
                </Button>
                <Button onClick={() => { onImageReady(previewUrl); onOpenChange(false); toast({ title: "Image applied" }); }}>
                  <Check className="w-4 h-4 mr-1" /> Confirm
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">Review the edit. Confirm to apply or retry with a new prompt.</p>
            </>
          ) : (
            <>
              {/* Canvas */}
              <div className="flex justify-center bg-muted rounded-lg p-2">
                <canvas
                  ref={canvasRef}
                  className="cursor-crosshair rounded touch-none max-w-full"
                  style={{ imageRendering: "auto" }}
                  onMouseDown={onPointerDown}
                  onMouseMove={onPointerMove}
                  onMouseUp={onPointerUp}
                  onMouseLeave={onPointerUp}
                  onTouchStart={onPointerDown}
                  onTouchMove={onPointerMove}
                  onTouchEnd={onPointerUp}
                />
              </div>
              {/* Controls */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Brush:</span>
                <Slider value={[brushSize]} onValueChange={([v]) => setBrushSize(v)} min={5} max={60} step={1} className="flex-1" />
                <span className="text-xs text-muted-foreground w-8 text-right">{brushSize}px</span>
                <Button variant="ghost" size="icon" onClick={handleUndo} disabled={strokes.length === 0}><Undo2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handleClear} disabled={strokes.length === 0}><Trash2 className="w-4 h-4" /></Button>
              </div>
              {/* Reference image thumbnail */}
              {referenceImage && (
                <div className="flex items-center gap-2">
                  <img src={referenceImage} alt="Reference" className="w-12 h-12 rounded border border-border object-cover" />
                  <span className="text-xs text-muted-foreground">Reference image</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReferenceImage(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
              {/* Prompt + Apply */}
              <div className="flex gap-2">
                <input
                  ref={refFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setReferenceImage(reader.result as string);
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => refFileInputRef.current?.click()} title="Upload reference image">
                  <ImagePlus className="w-4 h-4" />
                </Button>
                <Input placeholder="Describe the edit..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !loading && handleApply()} className="flex-1" />
                <Button onClick={handleApply} disabled={loading || !prompt.trim()}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {loading ? "Editing..." : "Apply"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Draw red marks on the areas you want to change, then describe the edit. Optionally upload a reference image.</p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
