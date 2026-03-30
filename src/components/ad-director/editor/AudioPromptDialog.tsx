import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Music, Upload, X, Sparkles } from "lucide-react";

export interface AudioPromptResult {
  type: "music" | "voiceover";
  prompt: string;
  duration: number;
}

export interface AudioUploadResult {
  file: File;
  kind: "music" | "voiceover";
}

interface AudioPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (result: AudioPromptResult) => void;
  onUpload?: (result: AudioUploadResult) => void;
  loading?: boolean;
}

export function AudioPromptDialog({ open, onOpenChange, onGenerate, onUpload, loading }: AudioPromptDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("30");

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onGenerate({ type: "music", prompt: prompt.trim(), duration: Number(duration) });
  };

  const handleFileChange = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const handleUploadSubmit = () => {
    if (!selectedFile || !onUpload) return;
    onUpload({ file: selectedFile, kind: "music" });
    handleFileChange(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) handleFileChange(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle>Music</DialogTitle>
          <DialogDescription>Generate music or upload an audio file.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="generate" className="flex-1 gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Generate with AI
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload File
            </TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Input
                placeholder="cinematic intro music..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
              />
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <ToggleGroup type="single" value={duration} onValueChange={(v) => v && setDuration(v)} className="justify-start">
                <ToggleGroupItem value="15" className="text-xs">15s</ToggleGroupItem>
                <ToggleGroupItem value="30" className="text-xs">30s</ToggleGroupItem>
                <ToggleGroupItem value="60" className="text-xs">60s</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={!prompt.trim() || loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : "Generate Music"}
              </Button>
            </div>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4 pt-2">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drag and drop a music file or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A, OGG</p>
            </div>

            {/* Preview */}
            {selectedFile && previewUrl && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                <Music className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{selectedFile.name}</p>
                  <audio src={previewUrl} controls className="w-full h-8 mt-1" />
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 h-6 w-6" onClick={() => handleFileChange(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleUploadSubmit} disabled={!selectedFile || !onUpload}>
                افزودن به تایم‌لاین
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
