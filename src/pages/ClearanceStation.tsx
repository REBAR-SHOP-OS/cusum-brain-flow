import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useClearanceData, ClearanceItem } from "@/hooks/useClearanceData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Send,
} from "lucide-react";

export default function ClearanceStation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { items, clearedCount, totalCount, byProject, isLoading } = useClearanceData();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/shop-floor")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-wider uppercase text-foreground">
              Clearance Station
            </h1>
            <p className="text-[10px] text-primary tracking-wider uppercase">
              QC Audit & Evidence Collection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1">
            <ShieldCheck className="w-4 h-4" />
            {clearedCount} / {totalCount} Cleared
          </Badge>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-8">
          {totalCount === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No items awaiting clearance</p>
            </div>
          ) : (
            [...byProject.entries()].map(([projectName, projectItems]) => (
              <div key={projectName}>
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h2 className="text-sm font-bold tracking-wider uppercase text-foreground">
                    Manifest: {projectName}
                  </h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {projectItems.filter((i) => i.evidence_status === "cleared").length} / {projectItems.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projectItems.map((item) => (
                    <ClearanceCard
                      key={item.id}
                      item={item}
                      canWrite={canWrite}
                      userId={user?.id}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Clearance Card ────────────────────────────────────────
interface ClearanceCardProps {
  item: ClearanceItem;
  canWrite: boolean;
  userId?: string;
}

function ClearanceCard({ item, canWrite, userId }: ClearanceCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<"material" | "tag" | null>(null);
  const [verifying, setVerifying] = useState(false);
  const materialRef = useRef<HTMLInputElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

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

      const { data: urlData } = supabase.storage
        .from("clearance-photos")
        .getPublicUrl(path);

      const photoUrl = urlData.publicUrl;
      const field = type === "material" ? "material_photo_url" : "tag_scan_url";

      // Upsert evidence row
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

      // Advance phase to complete
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
          url={item.material_photo_url}
          loading={uploading === "material"}
          disabled={!canWrite || isCleared}
          inputRef={materialRef}
          onFileSelect={(f) => handleUpload("material", f)}
        />
        <PhotoSlot
          label="Tag Scan"
          url={item.tag_scan_url}
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
