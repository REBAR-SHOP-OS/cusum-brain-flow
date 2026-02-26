import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { SignaturePad } from "@/components/shopfloor/SignaturePad";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, MapPin, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function DriverDropoff() {
  const { stopId } = useParams<{ stopId: string }>();
  const navigate = useNavigate();
  const { companyId } = useCompanyId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch stop details
  const { data: stop } = useQuery({
    queryKey: ["dropoff-stop", stopId],
    enabled: !!stopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_stops")
        .select("*, deliveries(delivery_number)")
        .eq("id", stopId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const deliveryNumber = (stop as any)?.deliveries?.delivery_number || "";

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large — max 10 MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!stopId || !companyId) return;
    setSaving(true);
    try {
      let photoPath: string | null = null;
      let signaturePath: string | null = null;

      if (photoFile) {
        const path = `${companyId}/pod/${stopId}-photo-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("clearance-photos").upload(path, photoFile);
        if (error) throw error;
        photoPath = path;
      }

      if (signatureData) {
        const blob = await (await fetch(signatureData)).blob();
        const path = `${companyId}/pod/${stopId}-sig-${Date.now()}.png`;
        const { error } = await supabase.storage.from("clearance-photos").upload(path, blob, { contentType: "image/png" });
        if (error) throw error;
        signaturePath = path;
      }

      const updates: Record<string, unknown> = {
        status: "completed",
        departure_time: new Date().toISOString(),
      };
      if (signaturePath) updates.pod_signature = signaturePath;
      if (photoPath) updates.pod_photo_url = photoPath;

      const { error } = await supabase.from("delivery_stops").update(updates).eq("id", stopId);
      if (error) throw error;

      // Update packing slips + auto-complete delivery
      if (stop?.delivery_id) {
        if (signaturePath || photoPath) {
          const slipUpdates: Record<string, unknown> = { status: "delivered" };
          if (signaturePath) slipUpdates.signature_path = signaturePath;
          if (photoPath) slipUpdates.site_photo_path = photoPath;
          await supabase.from("packing_slips" as any).update(slipUpdates).eq("delivery_id", stop.delivery_id);
        }

        const { data: allStops } = await supabase
          .from("delivery_stops")
          .select("id, status")
          .eq("delivery_id", stop.delivery_id);

        const allTerminal = allStops && allStops.length > 0 && allStops.every(s => s.status === "completed" || s.status === "failed");
        if (allTerminal) {
          const hasFailures = allStops.some(s => s.status === "failed");
          await supabase
            .from("deliveries")
            .update({ status: hasFailures ? "completed_with_issues" : "delivered" })
            .eq("id", stop.delivery_id);
        }
      }

      toast.success("Drop-off completed!");
      navigate("/driver");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = !saving && !!signatureData && !!photoFile;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/driver")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">DROP-OFF</h1>
          {deliveryNumber && (
            <p className="text-xs text-muted-foreground truncate">{deliveryNumber}</p>
          )}
        </div>
      </header>

      {/* Address bar */}
      {stop?.address && (
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="truncate">{stop.address}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="flex-shrink-0 gap-1.5 text-xs"
            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(stop.address!)}`, "_blank")}
          >
            Navigate
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Site Photo */}
        <section>
          <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Site Photo
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhoto}
          />
          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border">
              <img src={photoPreview} alt="Site" className="w-full max-h-56 object-cover" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 gap-1.5 text-xs"
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); fileRef.current?.click(); }}
              >
                <RotateCcw className="w-3 h-3" />
                Retake
              </Button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-36 rounded-xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-2 text-muted-foreground active:bg-muted/50 transition-colors"
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm font-medium">Tap to Take Photo</span>
            </button>
          )}
        </section>

        {/* Signature */}
        <section>
          <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            ✍️ Customer Signature
          </label>
          <SignaturePad
            onSignatureChange={setSignatureData}
            width={600}
            height={220}
          />
        </section>
      </div>

      {/* Bottom CTA */}
      <div className="px-4 py-4 border-t border-border bg-card sticky bottom-0">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-14 text-base gap-2 font-semibold"
          size="lg"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
          Complete Drop-Off
        </Button>
        {!canSubmit && !saving && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            {!photoFile && !signatureData
              ? "Photo and signature required"
              : !photoFile
              ? "Photo required"
              : "Signature required"}
          </p>
        )}
      </div>
    </div>
  );
}
