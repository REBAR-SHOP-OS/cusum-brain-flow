import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Camera,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { ClearanceItem } from "@/hooks/useClearanceData";

interface ClearanceCardProps {
  item: ClearanceItem;
  canWrite: boolean;
  userId?: string;
}

export function ClearanceCard({ item, canWrite, userId }: ClearanceCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<"material" | "tag" | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [signedUrls, setSignedUrls] = useState<{ material?: string; tag?: string }>({});
  const materialRef = useRef<HTMLInputElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  // Resolve signed URLs for private bucket photos
  useEffect(() => {
    async function resolveUrls() {
      const urls: { material?: string; tag?: string } = {};
      for (const [key, storedUrl] of [["material", item.material_photo_url], ["tag", item.tag_scan_url]] as const) {
        if (!storedUrl) continue;
        // If it's already a signed URL or contains /object/sign/, use directly
        if (storedUrl.includes("/object/sign/") || storedUrl.includes("token=")) {
          urls[key] = storedUrl;
          continue;
        }
        // Extract storage path from old public URLs or use as-is if it's just a path
        let storagePath = storedUrl;
        const publicMarker = "/object/public/clearance-photos/";
        const idx = storedUrl.indexOf(publicMarker);
        if (idx !== -1) {
          storagePath = storedUrl.substring(idx + publicMarker.length);
        }
        const { data } = await supabase.storage
          .from("clearance-photos")
          .createSignedUrl(storagePath, 3600);
        if (data?.signedUrl) urls[key] = data.signedUrl;
      }
      setSignedUrls(urls);
    }
    resolveUrls();
  }, [item.material_photo_url, item.tag_scan_url]);

  const isCleared = item.evidence_status === "cleared";

  const handleUpload = async (type: "material" | "tag", file: File) => {
    if (!canWrite) return;
    setUploading(type);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${item.id}/${type}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("clearance-photos")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      // Store the path reference for private bucket
      const photoUrl = path;
      const field = type === "material" ? "material_photo_url" : "tag_scan_url";

      if (item.evidence_id) {
        await supabase
          .from("clearance_evidence")
          .update({ [field]: photoUrl } as any)
          .eq("id", item.evidence_id);
      } else {
        await supabase
          .from("clearance_evidence")
          .insert({ cut_plan_item_id: item.id, [field]: photoUrl } as any);
      }

      await queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
      toast({ title: `${type === "material" ? "Material" : "Tag"} photo uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleVerify = async () => {
    if (!canWrite || isCleared) return;
    setVerifying(true);
    try {
      if (item.evidence_id) {
        await supabase
          .from("clearance_evidence")
          .update({
            status: "cleared",
            verified_by: userId,
            verified_at: new Date().toISOString(),
          } as any)
          .eq("id", item.evidence_id);
      } else {
        await supabase
          .from("clearance_evidence")
          .insert({
            cut_plan_item_id: item.id,
            status: "cleared",
            verified_by: userId,
            verified_at: new Date().toISOString(),
          } as any);
      }

      await supabase
        .from("cut_plan_items")
        .update({ phase: "complete" } as any)
        .eq("id", item.id);

      await queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
      toast({ title: "Item cleared", description: `${item.mark_number || "Item"} verified` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className={`rounded-xl border ${isCleared ? "border-primary/40 bg-primary/5" : "border-border bg-card"} p-4 flex flex-col gap-3`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] tracking-wider uppercase text-primary font-semibold">
            Clearance Item:
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {item.mark_number || "—"}
            </span>
            {item.drawing_ref && (
              <span className="text-xs text-primary font-medium">
                | DWG# {item.drawing_ref}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Size: {item.bar_code} | L: {item.cut_length_mm}mm
          </p>
        </div>
        {isCleared && (
          <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
        )}
      </div>

      {/* Photo slots */}
      <div className="grid grid-cols-2 gap-3">
        <PhotoSlot
          label="Material"
          url={signedUrls.material || null}
          loading={uploading === "material"}
          disabled={!canWrite || isCleared}
          inputRef={materialRef}
          onFileSelect={(f) => handleUpload("material", f)}
        />
        <PhotoSlot
          label="Tag Scan"
          url={signedUrls.tag || null}
          loading={uploading === "tag"}
          disabled={!canWrite || isCleared}
          inputRef={tagRef}
          onFileSelect={(f) => handleUpload("tag", f)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <Button
          className="flex-1 gap-1.5"
          variant={isCleared ? "secondary" : "default"}
          disabled={!canWrite || isCleared || verifying}
          onClick={handleVerify}
        >
          {verifying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isCleared ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Cleared
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Manual Verify
            </>
          )}
        </Button>
        {!isCleared && (
          <Button
            variant="destructive"
            size="icon"
            className="shrink-0"
            disabled={!canWrite}
            onClick={() => {
              toast({ title: "Flagged", description: `${item.mark_number || "Item"} flagged for review` });
            }}
          >
            <AlertTriangle className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Photo Upload Slot ─────────────────────────────────────
interface PhotoSlotProps {
  label: string;
  url: string | null;
  loading: boolean;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (file: File) => void;
}

function PhotoSlot({ label, url, loading, disabled, inputRef, onFileSelect }: PhotoSlotProps) {
  return (
    <div
      className={`relative aspect-[4/3] rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors ${disabled ? "opacity-60 pointer-events-none" : ""}`}
      onClick={() => inputRef.current?.click()}
    >
      {url ? (
        <img src={url} alt={label} className="w-full h-full object-cover" />
      ) : loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <Camera className="w-6 h-6" />
          <span className="text-[9px] tracking-wider uppercase font-medium">{label}</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
