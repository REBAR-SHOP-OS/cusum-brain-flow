import { useState, useEffect } from "react";
import { getSignedFileUrl } from "@/lib/storageUtils";
import { Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface StorageImagePreviewProps {
  storagePath: string;
  fileName: string;
  className?: string;
  thumbnail?: boolean;
}

export function StorageImagePreview({ storagePath, fileName, className, thumbnail = false }: StorageImagePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const signed = await getSignedFileUrl(storagePath);
        if (cancelled) return;
        if (!signed) { setError(true); return; }
        setUrl(signed);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [storagePath]);

  if (loading) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-muted/30 rounded-md border border-border",
        thumbnail ? "w-16 h-16" : "w-full max-w-[320px] h-40",
        className
      )}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center bg-muted/30 rounded-md border border-border gap-1",
        thumbnail ? "w-16 h-16" : "w-full max-w-[320px] h-24",
        className
      )}>
        <ImageOff className="w-4 h-4 text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground">Unavailable</p>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={fileName}
      className={cn(
        "rounded-md border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity",
        thumbnail ? "w-16 h-16" : "w-full max-w-[320px] max-h-[240px]",
        className
      )}
      onClick={() => window.open(url, "_blank")}
    />
  );
}
