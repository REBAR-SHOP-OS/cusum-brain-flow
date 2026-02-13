import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Pen, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanyId } from "@/hooks/useCompanyId";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface PODCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stopId: string;
  onComplete: () => void;
}

export function PODCaptureDialog({ open, onOpenChange, stopId, onComplete }: PODCaptureDialogProps) {
  const [signature, setSignature] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { companyId } = useCompanyId();

  // Fix 3: Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSignature("");
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  }, [open]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fix 2: File size validation
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

      if (photoFile && companyId) {
        const path = `${companyId}/pod/${stopId}-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("clearance-photos")
          .upload(path, photoFile);
        if (uploadErr) throw uploadErr;
        photoPath = path; // Store path, not public URL
      }

      const updates: {
        status: string;
        arrival_time: string;
        departure_time: string;
        pod_signature?: string;
        pod_photo_url?: string;
      } = {
        status: "completed",
        arrival_time: new Date().toISOString(), // Fix 5: Set arrival_time
        departure_time: new Date().toISOString(),
      };
      if (signature) updates.pod_signature = signature;
      if (photoPath) updates.pod_photo_url = photoPath;

      const { error } = await supabase
        .from("delivery_stops")
        .update(updates)
        .eq("id", stopId);
      if (error) throw error;

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
            <label className="text-sm font-medium mb-1 block">Photo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
            {photoPreview ? (
              <img src={photoPreview} alt="POD" className="rounded-lg max-h-40 w-full object-cover" />
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

          {/* Signature (text for now) */}
          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
              <Pen className="w-3.5 h-3.5" />
              Receiver Name / Signature
            </label>
            <Textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Enter receiver's name"
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving || (!signature && !photoFile)}
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
