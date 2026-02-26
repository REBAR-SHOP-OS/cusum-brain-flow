import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { SignaturePad } from "@/components/shopfloor/SignaturePad";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [driverSignatureData, setDriverSignatureData] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

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
      if (driverSignaturePath) updates.notes = `driver_signature:${driverSignaturePath}`;

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
  const today = format(new Date(), "MMM d, yyyy");

  if (stopLoading || slipLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-black/40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white text-black">
      {/* Top nav bar */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-black/20 bg-white sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/driver")} className="text-black">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold tracking-tight uppercase">Packing Slip</h1>
        {packingSlip?.slip_number && (
          <span className="ml-auto text-[11px] font-mono font-semibold text-gray-600">#{packingSlip.slip_number}</span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* ═══ PACKING SLIP DOCUMENT ═══ */}
        <div className="mx-auto max-w-[640px] p-3">

          {/* Company Header */}
          <div className="border-2 border-black">
            <div className="flex justify-between items-start px-4 py-3 border-b border-black">
              <div>
                <p className="text-lg font-black tracking-tight">Rebar.Shop Inc</p>
                <p className="text-[11px] leading-tight">7045 Edwards Blvd, Suite 401</p>
                <p className="text-[11px] leading-tight">Mississauga, ON L5S 1X2</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black uppercase tracking-wide">Packing Slip</p>
              </div>
            </div>

            {/* Row 1: Customer | Ship To | Delivery # | Delivery Date */}
            <div className="grid grid-cols-4 border-b border-black text-[11px]">
              <div className="border-r border-black px-2 py-1.5">
                <p className="font-bold uppercase text-[9px] tracking-widest text-gray-600">Customer</p>
                <p className="font-semibold mt-0.5 break-words">{packingSlip?.customer_name || "—"}</p>
              </div>
              <div className="border-r border-black px-2 py-1.5">
                <p className="font-bold uppercase text-[9px] tracking-widest text-gray-600">Ship To</p>
                <p className="font-semibold mt-0.5 break-words">{packingSlip?.ship_to || stop?.address || "—"}</p>
              </div>
              <div className="border-r border-black px-2 py-1.5">
                <p className="font-bold uppercase text-[9px] tracking-widest text-gray-600">Delivery #</p>
                <p className="font-semibold mt-0.5">{deliveryNumber || "—"}</p>
              </div>
              <div className="px-2 py-1.5">
                <p className="font-bold uppercase text-[9px] tracking-widest text-gray-600">Delivery Date</p>
                <p className="font-semibold mt-0.5">{today}</p>
              </div>
            </div>

            {/* Row 2: Invoice # | Invoice Date | Scope */}
            <div className="grid grid-cols-3 border-b border-black text-[11px]">
              <div className="border-r border-black px-2 py-1.5">
                <p className="font-bold uppercase text-[9px] tracking-widest text-gray-600">Invoice #</p>
                <p className="font-semibold mt-0.5">{packingSlip?.invoice_number || "—"}</p>
              </div>
              <div className="border-r border-black px-2 py-1.5">
                <p className="font-bold uppercase text-[9px] tracking-widest text-gray-600">Invoice Date</p>
                <p className="font-semibold mt-0.5">
                  {packingSlip?.invoice_date ? format(new Date(packingSlip.invoice_date), "MMM d, yyyy") : "—"}
                </p>
              </div>
              <div className="px-2 py-1.5">
                <p className="font-bold uppercase text-[9px] tracking-widest text-gray-600">Scope</p>
                <p className="font-semibold mt-0.5 break-words">{packingSlip?.scope || "—"}</p>
              </div>
            </div>

            {/* ═══ Items Table ═══ */}
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-gray-100 border-b border-black">
                  <th className="w-8 border-r border-black px-1 py-1.5 text-center font-bold text-[9px] uppercase tracking-wider">✓</th>
                  <th className="border-r border-black px-2 py-1.5 text-left font-bold text-[9px] uppercase tracking-wider">DW#</th>
                  <th className="border-r border-black px-2 py-1.5 text-left font-bold text-[9px] uppercase tracking-wider">Mark</th>
                  <th className="border-r border-black px-2 py-1.5 text-left font-bold text-[9px] uppercase tracking-wider">Qty × Size</th>
                  <th className="border-r border-black px-2 py-1.5 text-left font-bold text-[9px] uppercase tracking-wider">Type</th>
                  <th className="px-2 py-1.5 text-right font-bold text-[9px] uppercase tracking-wider">Cut Length</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-[11px]">
                      No items on this slip
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => toggleItem(idx)}
                      className={`border-b border-black/40 cursor-pointer active:bg-gray-100 transition-colors ${
                        checkedItems.has(idx) ? "bg-green-50" : ""
                      }`}
                    >
                      <td className="border-r border-black/40 px-1 py-2 text-center">
                        <div
                          className={`w-5 h-5 mx-auto border-2 rounded flex items-center justify-center transition-colors ${
                            checkedItems.has(idx)
                              ? "bg-green-600 border-green-600 text-white"
                              : "border-black/50"
                          }`}
                        >
                          {checkedItems.has(idx) && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-black/40 px-2 py-2 font-medium">{item.drawing_ref || "—"}</td>
                      <td className="border-r border-black/40 px-2 py-2">{item.mark_number || "—"}</td>
                      <td className="border-r border-black/40 px-2 py-2 font-semibold tabular-nums">
                        {item.total_pieces} × {item.bar_code}
                      </td>
                      <td className="border-r border-black/40 px-2 py-2">
                        {item.asa_shape_code ? "Bent" : "Straight"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {(item.cut_length_mm / 1000).toFixed(2)}m
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black bg-gray-100">
                  <td className="border-r border-black px-1 py-2 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAll(); }}
                      className="text-[9px] font-bold uppercase text-blue-700 underline"
                    >
                      {allChecked ? "None" : "All"}
                    </button>
                  </td>
                  <td colSpan={2} className="border-r border-black/40 px-2 py-2 font-bold">Total</td>
                  <td className="border-r border-black/40 px-2 py-2 font-bold tabular-nums">{totalQty} pcs</td>
                  <td colSpan={2} className="px-2 py-2 text-right text-[10px] text-gray-600">
                    {checkedItems.size}/{items.length} verified
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* ═══ Signature Areas ═══ */}
            <div className="grid grid-cols-2 border-t border-black">
              {/* Delivered By */}
              <div className="border-r border-black px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Delivered By (Driver)</p>
                <SignaturePad
                  onSignatureChange={setDriverSignatureData}
                  width={280}
                  height={100}
                  className="[&_div]:border-black/30 [&_div]:rounded-none [&_div]:border-b-2 [&_div]:border-t-0 [&_div]:border-l-0 [&_div]:border-r-0 [&_div]:bg-transparent"
                />
              </div>
              {/* Received By */}
              <div className="px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Received By (Customer)</p>
                <SignaturePad
                  onSignatureChange={setSignatureData}
                  width={280}
                  height={100}
                  className="[&_div]:border-black/30 [&_div]:rounded-none [&_div]:border-b-2 [&_div]:border-t-0 [&_div]:border-l-0 [&_div]:border-r-0 [&_div]:bg-transparent"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-black px-3 py-2 text-center text-[9px] text-gray-500">
              Rebar.Shop Inc · Tel: (905) 362-2262 · info@rebar.shop · www.rebar.shop
            </div>
          </div>

          {/* ═══ Site Photo (below the slip) ═══ */}
          <div className="mt-4 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600 mb-2 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              Site Drop Photo
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
            {photoPreview ? (
              <div className="relative rounded border border-black/20 overflow-hidden">
                <img src={photoPreview} alt="Site" className="w-full max-h-40 object-cover" />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-1 right-1 gap-1 text-[10px] h-6"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); fileRef.current?.click(); }}
                >
                  <RotateCcw className="w-3 h-3" /> Retake
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-24 rounded border-2 border-dashed border-black/30 flex flex-col items-center justify-center gap-1 text-gray-500 active:bg-gray-50 transition-colors"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[11px] font-medium">Tap to Capture</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-3 py-3 border-t border-black/20 bg-white sticky bottom-0 max-w-[640px] mx-auto w-full">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-12 text-sm gap-2 font-bold"
          size="lg"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Complete Drop-Off
        </Button>
        {!canSubmit && !saving && (
          <p className="text-[10px] text-gray-500 text-center mt-1.5">
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
  );
}
