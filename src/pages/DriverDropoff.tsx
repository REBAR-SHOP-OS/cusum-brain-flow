import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { SignatureModal } from "@/components/delivery/SignatureModal";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Camera, CheckCircle2, Loader2, RotateCcw, Pen,
  Download, Printer, Send, Navigation, Package,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import html2canvas from "html2canvas";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface SlipItem {
  mark_number: string | null;
  drawing_ref?: string | null;
  bar_code: string;
  cut_length_mm: number;
  total_pieces: number;
  asa_shape_code?: string | null;
}

export default function DriverDropoff() {
  const { stopId } = useParams<{ stopId: string }>();
  const navigate = useNavigate();
  const { companyId } = useCompanyId();
  const fileRef = useRef<HTMLInputElement>(null);
  const slipRef = useRef<HTMLDivElement>(null);

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [driverSignatureData, setDriverSignatureData] = useState<string | null>(null);
  const [driverSignedAt, setDriverSignedAt] = useState<Date | null>(null);
  const [customerSignedAt, setCustomerSignedAt] = useState<Date | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const [driverSigOpen, setDriverSigOpen] = useState(false);
  const [customerSigOpen, setCustomerSigOpen] = useState(false);

  // Fetch stop details
  const { data: stop, isLoading: stopLoading } = useQuery({
    queryKey: ["dropoff-stop", stopId],
    enabled: !!stopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_stops")
        .select("*, deliveries(delivery_number)")
        .eq("id", stopId!)
        .single();
      if (error) throw error;
      return data as typeof data & { deliveries: { delivery_number: string } | null };
    },
  });

  // Fetch packing slip for this delivery
  const { data: packingSlip, isLoading: slipLoading } = useQuery({
    queryKey: ["dropoff-packing-slip", stop?.delivery_id],
    enabled: !!stop?.delivery_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packing_slips")
        .select("*")
        .eq("delivery_id", stop!.delivery_id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const deliveryNumber = stop?.deliveries?.delivery_number || "";
  const items: SlipItem[] = (packingSlip?.items_json as unknown as SlipItem[]) || [];
  const totalQty = items.reduce((s, i) => s + i.total_pieces, 0);
  const allChecked = items.length > 0 && checkedItems.size === items.length;

  const toggleItem = (idx: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) setCheckedItems(new Set());
    else setCheckedItems(new Set(items.map((_, i) => i)));
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error("File too large — max 10 MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleDriverSigSave = (dataUrl: string) => {
    setDriverSignatureData(dataUrl);
    setDriverSignedAt(new Date());
  };

  const handleCustomerSigSave = (dataUrl: string) => {
    setSignatureData(dataUrl);
    setCustomerSignedAt(new Date());
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!slipRef.current) return;
    try {
      const canvas = await html2canvas(slipRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `packing-slip-${deliveryNumber || stopId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Downloaded!");
    } catch {
      toast.error("Download failed");
    }
  };

  const handleSendCustomer = () => toast.info("Coming soon — email integration pending");

  const handleLaunchNav = () => {
    const address = stop?.address;
    if (!address) { toast.error("No address available"); return; }
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, "_blank");
  };

  const handleSubmit = async () => {
    if (!stopId || !companyId) return;
    setSaving(true);
    try {
      let photoPath: string | null = null;
      let signaturePath: string | null = null;
      let driverSignaturePath: string | null = null;

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

      if (driverSignatureData) {
        const blob = await (await fetch(driverSignatureData)).blob();
        const path = `${companyId}/pod/${stopId}-driver-sig-${Date.now()}.png`;
        const { error } = await supabase.storage.from("clearance-photos").upload(path, blob, { contentType: "image/png" });
        if (error) throw error;
        driverSignaturePath = path;
      }

      const notesJson: Record<string, string> = {};
      if (driverSignaturePath) notesJson.driver_sig = driverSignaturePath;
      if (driverSignedAt) notesJson.driver_signed_at = driverSignedAt.toISOString();
      if (customerSignedAt) notesJson.customer_signed_at = customerSignedAt.toISOString();

      const updates: {
        status: string;
        departure_time: string;
        pod_signature?: string;
        pod_photo_url?: string;
        notes?: string;
      } = {
        status: "completed",
        departure_time: new Date().toISOString(),
      };
      if (signaturePath) updates.pod_signature = signaturePath;
      if (photoPath) updates.pod_photo_url = photoPath;
      if (Object.keys(notesJson).length > 0) updates.notes = JSON.stringify(notesJson);

      const { error } = await supabase.from("delivery_stops").update(updates).eq("id", stopId);
      if (error) throw error;

      if (stop?.delivery_id) {
        if (signaturePath || photoPath) {
          const slipUpdates: { status: string; signature_path?: string; site_photo_path?: string } = { status: "delivered" };
          if (signaturePath) slipUpdates.signature_path = signaturePath;
          if (photoPath) slipUpdates.site_photo_path = photoPath;
          await supabase.from("packing_slips").update(slipUpdates).eq("delivery_id", stop.delivery_id);
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

  const canSubmit = !saving && !!signatureData && !!photoFile && (items.length === 0 || allChecked);

  if (stopLoading || slipLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-muted/30">
      {/* ── Dark Header Bar ── */}
      <header className="bg-foreground text-background px-4 py-3 flex items-center justify-between sticky top-0 z-10 print:hidden">
        <button onClick={() => navigate("/driver")} className="w-8 h-8 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-black tracking-tight uppercase">
            {packingSlip?.customer_name || stop?.address?.split(",")[0] || "Delivery"}
          </p>
          <p className="text-[9px] tracking-[0.25em] text-primary uppercase font-semibold">Jobsite Delivery Terminal</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleDownloadPdf} className="w-8 h-8 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={handlePrint} className="w-8 h-8 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors">
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-28" ref={slipRef}>
        <div className="mx-auto max-w-[640px] p-4 space-y-4">

          {/* ── Unloading Site Card ── */}
          <div className="bg-background rounded-2xl shadow-sm border border-border p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] tracking-[0.2em] text-primary uppercase font-bold">Unloading Site</p>
                <p className="text-lg font-black uppercase tracking-tight text-foreground mt-0.5">
                  {stop?.address || "Pickup"}
                </p>
                {deliveryNumber && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Delivery #{deliveryNumber}
                    {packingSlip?.slip_number ? ` · Slip #${packingSlip.slip_number}` : ""}
                  </p>
                )}
              </div>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs font-bold rounded-xl shrink-0"
                onClick={handleLaunchNav}
              >
                <Navigation className="w-3.5 h-3.5" />
                Launch Nav
              </Button>
            </div>
          </div>

          {/* ── Site Drop Photo + Customer Sign-Off ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Site Drop Photo */}
            <div className="bg-background rounded-2xl shadow-sm border border-border p-4">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-bold mb-3">Site Drop Photo</p>
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
                  <img src={photoPreview} alt="Site" className="w-full h-32 object-cover" />
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); fileRef.current?.click(); }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
                  >
                    <RotateCcw className="w-3 h-3 text-foreground" />
                  </button>
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-background/80 backdrop-blur rounded-full px-2 py-0.5">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-[9px] font-semibold text-green-700">Captured</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-2 text-primary/60 hover:border-primary/50 hover:text-primary/80 active:bg-primary/5 transition-all"
                >
                  <Camera className="w-7 h-7" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Capture Drop Photo</span>
                </button>
              )}
            </div>

            {/* Customer Sign-Off */}
            <div className="bg-background rounded-2xl shadow-sm border border-border p-4">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-bold mb-3">Customer Sign-Off</p>
              {signatureData ? (
                <div className="relative rounded-xl border border-border overflow-hidden h-32 flex flex-col items-center justify-center bg-muted/30">
                  <img src={signatureData} alt="Customer signature" className="max-h-20 object-contain" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-background/80 backdrop-blur rounded-full px-2 py-0.5">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-[9px] font-semibold text-green-700">Signed</span>
                  </div>
                  <button
                    onClick={() => setCustomerSigOpen(true)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
                  >
                    <RotateCcw className="w-3 h-3 text-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCustomerSigOpen(true)}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-2 text-primary/60 hover:border-primary/50 hover:text-primary/80 active:bg-primary/5 transition-all"
                >
                  <Pen className="w-7 h-7" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Tap to Sign</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Driver Signature (smaller, secondary) ── */}
          <div className="bg-background rounded-2xl shadow-sm border border-border p-4">
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-bold mb-3">Driver Sign-Off</p>
            {driverSignatureData ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg border border-border p-2 bg-muted/30">
                  <img src={driverSignatureData} alt="Driver signature" className="h-10 object-contain" />
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-[10px] text-green-700 font-semibold">Signed</span>
                </div>
                <button
                  onClick={() => setDriverSigOpen(true)}
                  className="text-[10px] text-primary underline font-medium"
                >
                  Re-sign
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDriverSigOpen(true)}
                className="w-full h-16 rounded-xl border-2 border-dashed border-primary/30 flex items-center justify-center gap-2 text-primary/60 hover:border-primary/50 hover:text-primary/80 active:bg-primary/5 transition-all"
              >
                <Pen className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Tap to Sign</span>
              </button>
            )}
          </div>

          {/* ── Unloading Checklist ── */}
          <div className="bg-background rounded-2xl shadow-sm border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-bold">Unloading Checklist</p>
              {items.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                >
                  {allChecked ? "Uncheck All" : "Check All"}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No items on this slip</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {items.map((item, idx) => {
                  const checked = checkedItems.has(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleItem(idx)}
                      className={`relative rounded-xl border-2 p-3 text-left transition-all active:scale-[0.98] ${
                        checked
                          ? "border-green-500 bg-green-50 dark:bg-green-500/10"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {/* Checkbox indicator */}
                      <div className={`absolute top-2 right-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        checked
                          ? "bg-green-600 border-green-600"
                          : "border-muted-foreground/30"
                      }`}>
                        {checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <p className="text-sm font-black uppercase text-foreground">
                        {item.bar_code}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {item.drawing_ref || item.mark_number || "—"} · {item.total_pieces}pcs · {(item.cut_length_mm / 1000).toFixed(1)}m
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {items.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {checkedItems.size}/{items.length} verified · {totalQty} pcs total
                </p>
                {allChecked && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-[10px] font-bold text-green-700 uppercase">All Clear</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-background/95 backdrop-blur border-t border-border print:hidden z-10">
        <div className="max-w-[640px] mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full h-12 text-sm gap-2 font-bold rounded-xl"
            size="lg"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Complete Drop-Off
          </Button>
          {!canSubmit && !saving && (
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              {items.length > 0 && !allChecked
                ? `Verify all items (${checkedItems.size}/${items.length})`
                : !photoFile && !signatureData
                ? "Photo + signature required"
                : !photoFile
                ? "Photo required"
                : "Signature required"}
            </p>
          )}
        </div>
      </div>

      {/* Signature Modals */}
      <SignatureModal
        open={driverSigOpen}
        onOpenChange={setDriverSigOpen}
        onSave={handleDriverSigSave}
        title="Driver Signature"
      />
      <SignatureModal
        open={customerSigOpen}
        onOpenChange={setCustomerSigOpen}
        onSave={handleCustomerSigSave}
        title="Customer Signature"
      />
    </div>
  );
}
