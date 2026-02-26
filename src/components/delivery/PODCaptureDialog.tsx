import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Pen, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";
import { SignaturePad } from "@/components/shopfloor/SignaturePad";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface PODCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stopId: string;
  onComplete: () => void;
}

export function PODCaptureDialog({ open, onOpenChange, stopId, onComplete }: PODCaptureDialogProps) {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { companyId } = useCompanyId();

  useEffect(() => {
    if (!open) {
      setSignatureData(null);
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large — max 10MB per photo");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let photoPath: string | null = null;
      let signaturePath: string | null = null;

      if (photoFile && companyId) {
        const path = `${companyId}/pod/${stopId}-photo-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("clearance-photos")
          .upload(path, photoFile);
        if (uploadErr) throw uploadErr;
        photoPath = path;
      }

      // Upload signature canvas as PNG
      if (signatureData && companyId) {
        const blob = await (await fetch(signatureData)).blob();
        const sigPath = `${companyId}/pod/${stopId}-sig-${Date.now()}.png`;
        const { error: sigErr } = await supabase.storage
          .from("clearance-photos")
          .upload(sigPath, blob, { contentType: "image/png" });
        if (sigErr) throw sigErr;
        signaturePath = sigPath;
      }

      const updates: Record<string, unknown> = {
        status: "completed",
        departure_time: new Date().toISOString(),
      };
      if (signaturePath) updates.pod_signature = signaturePath;
      if (photoPath) updates.pod_photo_url = photoPath;

      const { error } = await supabase
        .from("delivery_stops")
        .update(updates)
        .eq("id", stopId);
      if (error) throw error;

      // Auto-complete delivery when all stops are done
      const { data: stop } = await supabase
        .from("delivery_stops")
        .select("delivery_id")
        .eq("id", stopId)
        .single();

      if (stop?.delivery_id) {
        // Update related packing_slips if paths exist
        if (signaturePath || photoPath) {
          const slipUpdates: Record<string, unknown> = {};
          if (signaturePath) slipUpdates.signature_path = signaturePath;
          if (photoPath) slipUpdates.site_photo_path = photoPath;
          slipUpdates.status = "delivered";

          await supabase
            .from("packing_slips" as any)
            .update(slipUpdates)
            .eq("delivery_id", stop.delivery_id);
        }

        // Check if all stops for this delivery are now completed
        const { data: allStops } = await supabase
          .from("delivery_stops")
          .select("id, status")
          .eq("delivery_id", stop.delivery_id);

        const allCompleted = allStops && allStops.length > 0 && allStops.every(s => s.status === "completed");
        if (allCompleted) {
          await supabase
            .from("deliveries")
            .update({ status: "delivered" })
            .eq("id", stop.delivery_id);
        }
      }

      toast.success("POD captured successfully");
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save POD");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Proof of Delivery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo */}
          <div>
            <label className="text-sm font-medium mb-1 block">Job Site Photo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="POD" className="rounded-lg max-h-40 w-full object-cover" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-6 text-xs"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-24 gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </Button>
            )}
          </div>

          {/* Canvas Signature */}
          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
              <Pen className="w-3.5 h-3.5" />
              Signature
            </label>
            <SignaturePad
              onSignatureChange={setSignatureData}
              width={380}
              height={160}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving || (!signatureData && !photoFile)}
            className="w-full gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Complete Delivery
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

PODCaptureDialog.displayName = "PODCaptureDialog";
