import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Camera,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { ClearanceItem } from "@/hooks/useClearanceData";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const materialRef = useRef<HTMLInputElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  // Resolve signed URLs for private bucket photos
  useEffect(() => {
    async function resolveUrls() {
      const urls: { material?: string; tag?: string } = {};
      for (const [key, storedUrl] of [["material", item.material_photo_url], ["tag", item.tag_scan_url]] as const) {
        if (!storedUrl) continue;
        if (storedUrl.includes("/object/sign/") || storedUrl.includes("token=")) {
          urls[key] = storedUrl;
          continue;
        }
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
  const isFlagged = item.evidence_status === "flagged";
  const hasEvidence = !!signedUrls.material;

  const handleUpload = async (type: "material" | "tag", file: File) => {
    if (!canWrite) return;

    // Fix 2: File size validation
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Max 10MB per photo.", variant: "destructive" });
      return;
    }

    setUploading(type);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${item.id}/${type}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("clearance-photos")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const photoUrl = path;
      const field = type === "material" ? "material_photo_url" : "tag_scan_url";

      if (item.evidence_id) {
        await supabase
          .from("clearance_evidence")
          .update({ [field]: photoUrl })
          .eq("id", item.evidence_id);
      } else {
        await supabase
          .from("clearance_evidence")
          .insert({ cut_plan_item_id: item.id, [field]: photoUrl });
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
          })
          .eq("id", item.evidence_id);
      } else {
        await supabase
          .from("clearance_evidence")
          .insert({
            cut_plan_item_id: item.id,
            status: "cleared",
            verified_by: userId,
            verified_at: new Date().toISOString(),
          });
      }

      await supabase
        .from("cut_plan_items")
        .update({ phase: "complete" })
        .eq("id", item.id);

      await queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
      toast({ title: "Item cleared", description: `${item.mark_number || "Item"} verified` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  // Fix 1: Persist flag action
  const handleFlag = async () => {
    if (!canWrite) return;
    try {
      if (item.evidence_id) {
        await supabase
          .from("clearance_evidence")
          .update({ status: "flagged" })
          .eq("id", item.evidence_id);
      } else {
        await supabase
          .from("clearance_evidence")
          .insert({ cut_plan_item_id: item.id, status: "flagged" });
      }
      await queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
      toast({ title: "Flagged", description: `${item.mark_number || "Item"} flagged for review` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const borderClass = isCleared
    ? "border-primary/40 bg-primary/5"
    : isFlagged
    ? "border-amber-500/60 bg-amber-500/5"
    : "border-border bg-card";

  return (
    <TooltipProvider>
      <div className={`rounded-xl border ${borderClass} p-4 flex flex-col gap-3`}>
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
          {isCleared && <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />}
          {isFlagged && <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />}
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
            onPreview={(url) => setPreviewUrl(url)}
          />
          <PhotoSlot
            label="Tag Scan"
            url={signedUrls.tag || null}
            loading={uploading === "tag"}
            disabled={!canWrite || isCleared}
            inputRef={tagRef}
            onFileSelect={(f) => handleUpload("tag", f)}
            onPreview={(url) => setPreviewUrl(url)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1">
                <Button
                  className="w-full gap-1.5"
                  variant={isCleared ? "secondary" : "default"}
                  disabled={!canWrite || isCleared || verifying || !hasEvidence}
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
              </span>
            </TooltipTrigger>
            {!hasEvidence && !isCleared && (
              <TooltipContent>Upload material photo before verifying</TooltipContent>
            )}
          </Tooltip>
          {!isCleared && (
            <Button
              variant="destructive"
              size="icon"
              className="shrink-0"
              disabled={!canWrite || isFlagged}
              onClick={handleFlag}
            >
              <AlertTriangle className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Fix 7: Fullscreen photo preview */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
            {previewUrl && (
              <img src={previewUrl} alt="Evidence preview" className="w-full h-full object-contain rounded" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

ClearanceCard.displayName = "ClearanceCard";

// ─── Photo Upload Slot ─────────────────────────────────────
interface PhotoSlotProps {
  label: string;
  url: string | null;
  loading: boolean;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (file: File) => void;
  onPreview: (url: string) => void;
}

function PhotoSlot({ label, url, loading, disabled, inputRef, onFileSelect, onPreview }: PhotoSlotProps) {
  return (
    <div
      className={`relative aspect-[4/3] rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors ${disabled ? "opacity-60 pointer-events-none" : ""}`}
      onClick={() => {
        if (url) {
          onPreview(url);
        } else {
          inputRef.current?.click();
        }
      }}
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

PhotoSlot.displayName = "PhotoSlot";
