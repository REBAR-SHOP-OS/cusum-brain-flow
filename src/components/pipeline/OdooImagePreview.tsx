import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface OdooImagePreviewProps {
  odooId: string | number;
  fileName: string;
  className?: string;
  thumbnail?: boolean;
}

export function OdooImagePreview({ odooId, fileName, className, thumbnail = false }: OdooImagePreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setError(true); setLoading(false); return; }

        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/odoo-file-proxy?id=${odooId}`;
        const res = await fetch(proxyUrl, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) { setError(true); setLoading(false); return; }

        const blob = await res.blob();
        if (cancelled) return;
        setBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [odooId]);

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

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

  if (error || !blobUrl) {
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
      src={blobUrl}
      alt={fileName}
      className={cn(
        "rounded-md border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity",
        thumbnail ? "w-16 h-16" : "w-full max-w-[320px] max-h-[240px]",
        className
      )}
      onClick={() => window.open(blobUrl, "_blank")}
    />
  );
}
