import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface VizzyPhotoButtonProps {
  onAnalysisReady: (analysis: string) => void;
}

export function VizzyPhotoButton({ onAnalysisReady }: VizzyPhotoButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    try {
      // Upload to storage
      const path = `vizzy-photos/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("clearance-photos").upload(path, file);
      if (uploadErr) throw uploadErr;

      // Get signed URL (1 hour)
      const { data: urlData } = await supabase.storage.from("clearance-photos").createSignedUrl(path, 3600);
      if (!urlData?.signedUrl) throw new Error("Failed to get signed URL");

      // Call analysis edge function
      const { data, error } = await supabase.functions.invoke("vizzy-photo-analyze", {
        body: { imageUrl: urlData.signedUrl },
      });

      if (error) throw error;
      onAnalysisReady(data.analysis || "Could not analyze the photo.");
    } catch (err) {
      console.error("Photo analysis failed:", err);
      onAnalysisReady("Sorry, I couldn't analyze that photo. Please try again.");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={analyzing}
        className={cn(
          "absolute bottom-6 left-6 p-3 rounded-full transition-colors",
          "bg-white/10 text-white/80 hover:bg-white/20",
          analyzing && "animate-pulse"
        )}
        aria-label="Send photo to Vizzy"
      >
        {analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
      </button>
    </>
  );
}
