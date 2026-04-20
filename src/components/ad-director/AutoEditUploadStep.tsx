import { useCallback } from "react";
import { UploadCloud, FileVideo } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoEditUploadStepProps {
  onFileSelected: (file: File) => void;
}

const MAX_BYTES = 100 * 1024 * 1024;
const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];

export function AutoEditUploadStep({ onFileSelected }: AutoEditUploadStepProps) {
  const validate = useCallback((file: File | null): file is File => {
    if (!file) return false;
    if (!ACCEPTED.includes(file.type)) {
      alert("Unsupported format. Use MP4, MOV, WebM or MKV.");
      return false;
    }
    if (file.size > MAX_BYTES) {
      alert("File too large. Maximum is 100MB.");
      return false;
    }
    return true;
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (validate(file)) onFileSelected(file);
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (validate(file)) onFileSelected(file);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={cn(
          "flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-emerald-400/30 bg-emerald-400/5 px-8 py-16 text-center transition-colors",
          "hover:border-emerald-400/60 hover:bg-emerald-400/10",
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
          <UploadCloud className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-white">Drop your raw video here</p>
          <p className="text-sm text-white/60">or click to browse</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/45">
          <FileVideo className="h-3.5 w-3.5" />
          MP4 · MOV · WebM · MKV — up to 100MB
        </div>
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          className="hidden"
          onChange={handlePick}
        />
      </label>

      <div className="max-w-xl text-center text-xs text-white/45">
        Your video stays private. AI watches keyframes, proposes a tight edit,
        and the final export is <span className="font-medium text-white/70">silent</span> — no audio or music.
      </div>
    </div>
  );
}
