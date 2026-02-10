import { useState, useRef } from "react";
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
  const companyId = useCompanyId();

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let photoUrl: string | null = null;

      if (photoFile && companyId) {
        const path = `${companyId}/pod/${stopId}-${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("clearance-photos")
          .upload(path, photoFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("clearance-photos")
          .getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      const updates: Record<string, any> = {
        status: "completed",
        departure_time: new Date().toISOString(),
      };
      if (signature) updates.pod_signature = signature;
      if (photoUrl) updates.pod_photo_url = photoUrl;

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
