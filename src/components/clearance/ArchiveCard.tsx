import { useEffect, useRef, useState } from "react";
import { ArchiveRow, resolveClearancePhotoUrl } from "@/hooks/useClearanceArchive";
import { Badge } from "@/components/ui/badge";
import { ImageOff, Zap, Hand } from "lucide-react";

interface Props {
  row: ArchiveRow;
  onOpen: (urls: { tag: string | null; product: string | null; row: ArchiveRow }) => void;
}

export function ArchiveCard({ row, onOpen }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = useState(false);
  const [urls, setUrls] = useState<{ tag: string | null; product: string | null }>({
    tag: null,
    product: null,
  });

  // Lazy-load signed URLs when card enters viewport
  useEffect(() => {
    if (!ref.current || seen) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    let cancelled = false;
    (async () => {
      const [tag, product] = await Promise.all([
        resolveClearancePhotoUrl(row.tag_scan_url),
        resolveClearancePhotoUrl(row.material_photo_url),
      ]);
      if (!cancelled) setUrls({ tag, product });
    })();
    return () => {
      cancelled = true;
    };
  }, [seen, row.tag_scan_url, row.material_photo_url]);

  const when = row.verified_at
    ? new Date(row.verified_at).toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const method = row.verification_method?.toLowerCase() || "manual";
  const isAuto = method === "auto";

  return (
    <button
      ref={ref}
      onClick={() => onOpen({ ...urls, row })}
      className="text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors"
    >
      <div className="grid grid-cols-2 gap-px bg-border/60">
        <PhotoSlot label="TAG" url={urls.tag} hasSource={!!row.tag_scan_url} />
        <PhotoSlot label="PRODUCT" url={urls.product} hasSource={!!row.material_photo_url} />
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold tracking-wider uppercase text-foreground">
            {row.mark_number || row.bar_code || "—"}
          </span>
          {row.cut_length_mm != null && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {row.cut_length_mm} mm
            </span>
          )}
          {row.total_pieces != null && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              · {row.total_pieces} pc
            </span>
          )}
          <Badge
            variant={isAuto ? "default" : "secondary"}
            className="ml-auto text-[9px] gap-1"
          >
            {isAuto ? <Zap className="w-2.5 h-2.5" /> : <Hand className="w-2.5 h-2.5" />}
            {method.toUpperCase()}
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {row.manifest_label || "(no manifest)"}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {row.customer_name || "Unassigned"}
          {row.project_name ? ` · ${row.project_name}` : ""}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
          <span className="text-[10px] text-muted-foreground tabular-nums">{when}</span>
          <span className="text-[10px] text-muted-foreground truncate">
            {row.verified_by_name || "Unknown operator"}
          </span>
        </div>
      </div>
    </button>
  );
}

function PhotoSlot({
  label,
  url,
  hasSource,
}: {
  label: string;
  url: string | null;
  hasSource: boolean;
}) {
  return (
    <div className="aspect-square relative bg-muted/40 flex items-center justify-center overflow-hidden">
      {url ? (
        <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" />
      ) : hasSource ? (
        <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      ) : (
        <div className="flex flex-col items-center text-muted-foreground gap-1">
          <ImageOff className="w-5 h-5 opacity-60" />
          <span className="text-[9px] uppercase tracking-wider">Missing</span>
        </div>
      )}
      <span className="absolute top-1 left-1 text-[9px] font-bold tracking-wider uppercase bg-background/70 text-foreground px-1.5 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
}
