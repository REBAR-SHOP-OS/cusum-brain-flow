import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eraser, Check, Loader2 } from "lucide-react";

interface ESignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber?: string;
  onSigned?: () => void;
}

export function ESignatureDialog({ open, onOpenChange, quoteId, quoteNumber, onSigned }: ESignatureDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "hsl(var(--foreground))";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    return ctx;
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * 2;
          canvas.height = rect.height * 2;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.scale(2, 2);
        }
      }, 100);
      setHasSignature(false);
      setSignerName("");
    }
  }, [open]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
    }
    setHasSignature(false);
  };

  const handleSign = async () => {
    if (!hasSignature || !signerName.trim()) {
      toast.error("Please draw your signature and enter your name");
      return;
    }
    setSaving(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not found");
      const signatureData = canvas.toDataURL("image/png");

      const { error } = await supabase
        .from("quotes")
        .update({
          signature_data: signatureData,
          signed_by: signerName.trim(),
          signed_at: new Date().toISOString(),
          status: "accepted",
        })
        .eq("id", quoteId);

      if (error) throw error;
      toast.success("Quote signed successfully!");
      onSigned?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save signature");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sign {quoteNumber ? `Quote ${quoteNumber}` : "Quote"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Your Name *</Label>
            <Input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Full legal name" />
          </div>
          <div>
            <Label>Signature *</Label>
            <div className="border border-border rounded-lg bg-background relative mt-1">
              <canvas
                ref={canvasRef}
                className="w-full h-40 cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              {!hasSignature && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
                  Draw your signature here
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="mt-1 text-xs gap-1" onClick={clearCanvas}>
              <Eraser className="w-3 h-3" /> Clear
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            By signing, you agree to the terms and conditions outlined in this quotation.
          </p>
          <Button className="w-full gap-2" disabled={saving || !hasSignature || !signerName.trim()} onClick={handleSign}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Sign & Accept Quote
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
