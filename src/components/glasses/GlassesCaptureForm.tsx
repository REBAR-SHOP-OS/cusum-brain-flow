import { useRef, useState } from "react";
import { Camera, Loader2, Send, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface GlassesCaptureFormProps {
  onCapture: (analysis: string, imageUrl?: string) => void;
}

export function GlassesCaptureForm({ onCapture }: GlassesCaptureFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    try {
      // Convert to base64
      const buffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Call webhook with JWT (supabase.functions.invoke adds auth header)
      const { data, error } = await supabase.functions.invoke("vizzy-glasses-webhook", {
        body: { imageBase64: base64, prompt: prompt || undefined },
      });

      if (error) throw error;
      onCapture(data.analysis || "Could not analyze.", preview || undefined);
      setSelectedFile(null);
      setPreview(null);
      setPrompt("");
    } catch (err) {
      console.error("Capture failed:", err);
      onCapture("Sorry, analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img src={preview} alt="Preview" className="w-full max-h-64 object-cover" />
          <button
            onClick={() => { setPreview(null); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyzing}
          className={cn(
            "w-full flex flex-col items-center justify-center gap-3 py-12 rounded-lg border-2 border-dashed border-muted-foreground/30",
            "hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
          )}
        >
          <div className="p-4 rounded-full bg-primary/10">
            <Camera className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Tap to capture or select photo</p>
            <p className="text-xs text-muted-foreground mt-1">Camera or Meta View gallery</p>
          </div>
        </button>
      )}

      <Textarea
        placeholder="Optional: Ask a specific question about this photo..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        className="resize-none"
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={analyzing}
          className="flex-1"
        >
          <ImagePlus className="w-4 h-4 mr-2" />
          {preview ? "Change" : "Gallery"}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedFile || analyzing}
          className="flex-1"
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {analyzing ? "Analyzing..." : "Analyze"}
        </Button>
      </div>
    </div>
  );
}
