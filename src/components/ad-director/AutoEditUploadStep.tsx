import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileVideo, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AutoEditUploadStepProps {
  onFilesSelected: (files: File[]) => void;
}

const MAX_PER_FILE = 100 * 1024 * 1024; // 100MB
const MAX_TOTAL = 200 * 1024 * 1024; // 200MB
const MAX_FILES = 5;
const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function AutoEditUploadStep({ onFilesSelected }: AutoEditUploadStepProps) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[] | null) => {
      if (!incoming) return;
      const arr = Array.from(incoming);
      const next = [...files];
      for (const f of arr) {
        if (!ACCEPTED.includes(f.type)) {
          alert(`Unsupported format: ${f.name}. Use MP4, MOV, WebM or MKV.`);
          continue;
        }
        if (f.size > MAX_PER_FILE) {
          alert(`${f.name} is too large. Max 100MB per file.`);
          continue;
        }
        if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
        next.push(f);
      }
      if (next.length > MAX_FILES) {
        alert(`Maximum ${MAX_FILES} clips per batch.`);
        next.length = MAX_FILES;
      }
      const total = next.reduce((acc, x) => acc + x.size, 0);
      if (total > MAX_TOTAL) {
        alert("Combined size exceeds 200MB. Remove a clip and try again.");
        return;
      }
      setFiles(next);
    },
    [files],
  );

  const removeAt = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = "";
  };

  const totalSize = files.reduce((a, f) => a + f.size, 0);
  const canContinue = files.length > 0;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-4">
      {files.length === 0 ? (
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
            <p className="text-lg font-semibold text-white">Drop your raw videos here</p>
            <p className="text-sm text-white/60">or click to browse — up to {MAX_FILES} clips</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/45">
            <FileVideo className="h-3.5 w-3.5" />
            MP4 · MOV · WebM · MKV — 100MB each, 200MB total
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
            className="hidden"
            onChange={handlePick}
          />
        </label>
      ) : (
        <div
          className="w-full max-w-2xl space-y-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">
              {files.length} clip{files.length > 1 ? "s" : ""} selected · {fmtSize(totalSize)}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              disabled={files.length >= MAX_FILES}
              className="gap-1.5 text-emerald-300 hover:bg-emerald-400/10 hover:text-emerald-200"
            >
              <Plus className="h-3.5 w-3.5" /> Add more
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              className="hidden"
              onChange={handlePick}
            />
          </div>

          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {files.map((f, i) => (
              <ClipRow key={`${f.name}-${i}`} file={f} index={i} onRemove={() => removeAt(i)} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFiles([])}
              className="text-white/60 hover:text-white"
            >
              Clear all
            </Button>
            <Button
              type="button"
              onClick={() => onFilesSelected(files)}
              disabled={!canContinue}
              className="bg-emerald-500 text-white hover:bg-emerald-600"
            >
              Analyze {files.length} clip{files.length > 1 ? "s" : ""} →
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-xl text-center text-xs text-white/45">
        Your videos stay private. AI watches keyframes from each clip, picks the best
        moments, and the final export is <span className="font-medium text-white/70">silent</span>.
      </div>
    </div>
  );
}

function ClipRow({ file, index, onRemove }: { file: File; index: number; onRemove: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let cancelled = false;
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.onloadeddata = () => {
      try {
        const c = document.createElement("canvas");
        const w = 96;
        const h = Math.round((v.videoHeight || 56) * (w / (v.videoWidth || 96)));
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          if (!cancelled) setThumb(c.toDataURL("image/jpeg", 0.6));
        }
      } catch {
        // ignore
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    v.onerror = () => URL.revokeObjectURL(url);
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-xs font-semibold text-emerald-200">
        {index + 1}
      </div>
      <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-black/60">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/30">
            <FileVideo className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{file.name}</p>
        <p className="text-[11px] text-white/45">{fmtSize(file.size)}</p>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onRemove}
        className="h-7 w-7 text-rose-300/70 hover:bg-rose-500/10 hover:text-rose-200"
        aria-label="Remove clip"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
