import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload, Sparkles, X, Loader2, CheckCircle2, ImagePlus, Trash2, Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UploadedSchematic {
  id: string;
  shape_code: string;
  image_url: string;
  ai_analysis: string | null;
  created_at: string;
}

interface PendingFile {
  file: File;
  preview: string;
  name: string;       // user-assigned tag/name for this shape
  status: "pending" | "uploading" | "done" | "error";
  result?: { shape_code?: string; confidence?: number; description?: string };
  error?: string;
}

interface AiVisionUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadsComplete: () => void;
}

export function AiVisionUploadDialog({ open, onOpenChange, onUploadsComplete }: AiVisionUploadDialogProps) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Cleanup previews on unmount
  useEffect(() => {
    return () => files.forEach((f) => URL.revokeObjectURL(f.preview));
  }, []);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newFiles: PendingFile[] = selected.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").toUpperCase(),
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateFileName = (index: number, name: string) => {
    setFiles((prev) => prev.map((f, i) => i === index ? { ...f, name } : f));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const processAll = async () => {
    if (!files.length) return;
    setIsProcessing(true);

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status === "done") continue;

      // Mark uploading
      setFiles((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "uploading" } : p));

      try {
        const code = f.name.trim() || `SHAPE_${Date.now()}`;
        const ext = f.file.name.split(".").pop()?.toLowerCase() || "png";
        const storagePath = `${code.replace(/\s+/g, "_")}_${Date.now()}.${ext}`;

        // Upload to storage
        const { error: uploadErr } = await supabase.storage
          .from("shape-schematics")
          .upload(storagePath, f.file, { upsert: true, contentType: f.file.type });

        if (uploadErr) throw uploadErr;

        // Generate signed URL for AI analysis (bucket is private)
        const { data: signedData } = await supabase.storage
          .from("shape-schematics")
          .createSignedUrl(storagePath, 3600);
        const imageUrl = signedData?.signedUrl || "";

        // AI analysis
        let analysis: any = null;
        try {
          const { data, error } = await supabase.functions.invoke("shape-vision", {
            body: { imageUrl, action: "analyze" },
          });
          if (!error && data) analysis = data;
        } catch {
          // AI analysis is optional, continue without it
        }

        // Save to DB — store the storage path (not full URL) so signed URLs can be generated later
        await supabase.from("custom_shape_schematics").insert({
          shape_code: code,
          image_url: storagePath,
          ai_analysis: analysis ? JSON.stringify(analysis) : null,
          uploaded_by: "system",
        });

        setFiles((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "done", result: analysis || undefined } : p
          )
        );
        successCount++;
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "error", error: err.message } : p
          )
        );
      }
    }

    setIsProcessing(false);
    if (successCount > 0) {
      toast({
        title: `${successCount} shape${successCount > 1 ? "s" : ""} uploaded`,
        description: "AI analysis complete. Shapes are now available as tags.",
      });
      onUploadsComplete();
    }
  };

  const handleClose = (v: boolean) => {
    if (!isProcessing) {
      if (!v) {
        files.forEach((f) => URL.revokeObjectURL(f.preview));
        setFiles([]);
      }
      onOpenChange(v);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Vision — Bulk Shape Upload
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Upload shape images and name them. AI will analyze each image to identify the ASA shape code.
          Names become tags usable across the system.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />

        {files.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer"
          >
            <ImagePlus className="w-10 h-10 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Click to select shape images</span>
            <span className="text-[10px] text-muted-foreground">PNG, JPG, or PDF — select multiple files</span>
          </button>
        ) : (
          <>
            {/* Status bar */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 text-xs">
                <ImagePlus className="w-3 h-3" /> {files.length} total
              </Badge>
              {doneCount > 0 && (
                <Badge className="gap-1 text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0">
                  <CheckCircle2 className="w-3 h-3" /> {doneCount} done
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="outline" className="gap-1 text-xs">
                  {pendingCount} pending
                </Badge>
              )}
            </div>

            {/* File list */}
            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="space-y-2 pr-2">
                {files.map((f, i) => (
                  <Card key={i} className={`border ${f.status === "done" ? "border-emerald-500/40 bg-emerald-500/5" : f.status === "error" ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      {/* Thumbnail */}
                      <img
                        src={f.preview}
                        alt={f.name}
                        className="w-14 h-14 rounded-lg object-contain border border-border bg-muted"
                      />

                      {/* Name input */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                          <Input
                            value={f.name}
                            onChange={(e) => updateFileName(i, e.target.value.toUpperCase())}
                            disabled={f.status === "done" || f.status === "uploading"}
                            className="h-7 text-xs font-bold uppercase"
                            placeholder="SHAPE NAME / TAG"
                          />
                        </div>
                        {f.status === "done" && f.result && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 pl-5">
                            AI detected: {f.result.shape_code} ({Math.round((f.result.confidence || 0) * 100)}%)
                          </p>
                        )}
                        {f.status === "error" && (
                          <p className="text-[10px] text-destructive pl-5">{f.error}</p>
                        )}
                        {f.status === "uploading" && (
                          <p className="text-[10px] text-muted-foreground pl-5 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Uploading & analyzing...
                          </p>
                        )}
                      </div>

                      {/* Status / remove */}
                      {f.status === "done" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : f.status === "uploading" ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeFile(i)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <ImagePlus className="w-4 h-4" /> Add More
              </Button>
              <div className="flex-1" />
              {doneCount === files.length && doneCount > 0 ? (
                <Button size="sm" onClick={() => handleClose(false)} className="gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Done
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={processAll}
                  disabled={isProcessing || pendingCount === 0}
                  className="gap-1.5"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isProcessing ? "Processing..." : `Analyze & Upload ${pendingCount}`}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
