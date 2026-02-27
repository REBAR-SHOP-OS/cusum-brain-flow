import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/delivery/SignaturePad";
import { ArrowLeft, Navigation, Camera, Download, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  drawing_ref?: string;
  mark_number?: string;
  total_pieces?: number;
  bar_code?: string;
  cut_length_mm?: number;
  checked?: boolean;
}

export default function DeliveryTerminal() {
  const { stopId } = useParams<{ stopId: string }>();
  const { companyId } = useCompanyId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!stopId || !companyId) return;
    (async () => {
      setLoading(true);
      const { data: stop } = await supabase
        .from("delivery_stops")
        .select("id, delivery_id, address, pod_photo_url, pod_signature")
        .eq("id", stopId)
        .eq("company_id", companyId)
        .single();

      if (!stop) { setLoading(false); return; }
      setDeliveryId(stop.delivery_id);
      if (stop.pod_photo_url && stop.pod_signature) setCompleted(true);

      const { data: slips } = await supabase
        .from("packing_slips")
        .select("customer_name, items_json, site_address")
        .eq("delivery_id", stop.delivery_id)
        .eq("company_id", companyId);

      const slip = slips?.[0];
      setCustomerName(slip?.customer_name || "Customer");
      setSiteAddress(slip?.site_address || stop.address || "");

      const allItems: ChecklistItem[] = [];
      slips?.forEach((s) => {
        const arr = Array.isArray(s.items_json) ? s.items_json : [];
        arr.forEach((item: any) => allItems.push({ ...item, checked: false }));
      });
      setItems(allItems);
      setLoading(false);
    })();
  }, [stopId, companyId]);

  const toggleItem = (idx: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it)));
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const launchNav = () => {
    if (!siteAddress) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(siteAddress)}`, "_blank");
  };

  const handleSubmit = async () => {
    if (!stopId || !companyId) return;
    if (!photoFile && !signatureData) {
      toast.error("Please capture a site photo and customer signature");
      return;
    }
    setSaving(true);

    try {
      let photoPath: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `pod/${stopId}-photo.${ext}`;
        const { error } = await supabase.storage.from("clearance-photos").upload(path, photoFile, { upsert: true });
        if (!error) photoPath = path;
      }

      // Save signature as base64 in pod_signature column
      const updates: Record<string, any> = {
        status: "delivered",
        pod_signature: signatureData,
        notes: JSON.stringify({
          checklist_completed: items.filter((i) => i.checked).length,
          checklist_total: items.length,
          completed_at: new Date().toISOString(),
        }),
      };
      if (photoPath) updates.pod_photo_url = photoPath;

      const { error } = await supabase
        .from("delivery_stops")
        .update(updates)
        .eq("id", stopId)
        .eq("company_id", companyId);

      if (error) throw error;
      toast.success("Delivery confirmed!");
      setCompleted(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-card/90 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3">
          <Link to="/shopfloor/delivery-ops" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-sm font-black tracking-wider text-foreground uppercase">{customerName}</h1>
            <p className="text-[9px] tracking-[0.25em] text-primary/70 uppercase">Jobsite Delivery Terminal</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Download className="w-4 h-4" />
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {completed && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">Delivery Confirmed</span>
          </div>
        )}

        {/* Unloading Site */}
        {siteAddress && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-0.5">Unloading Site</p>
              <p className="text-sm text-foreground font-medium">{siteAddress}</p>
            </div>
            <Button size="sm" variant="outline" onClick={launchNav} className="gap-1.5 text-xs uppercase tracking-wider">
              <Navigation className="w-3.5 h-3.5" />
              Launch Nav
            </Button>
          </div>
        )}

        {/* Photo & Signature side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Site Drop Photo */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-bold">Site Drop Photo</p>
            <div
              className={cn(
                "relative flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 aspect-[4/3] overflow-hidden cursor-pointer hover:border-primary/40 transition-colors",
                photoPreview && "border-solid border-primary/40"
              )}
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Site drop" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] tracking-wider uppercase">Tap to Capture</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </div>

          {/* Customer Sign-Off */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-bold">Customer Sign-Off</p>
            <SignaturePad
              onSignatureChange={setSignatureData}
              width={300}
              height={225}
              className="aspect-[4/3]"
            />
          </div>
        </div>

        {/* Unloading Checklist */}
        {items.length > 0 && (
          <div>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-bold mb-2">
              Unloading Checklist ({items.filter((i) => i.checked).length}/{items.length})
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((item, idx) => (
                <label
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md border border-border/50 bg-card/40 cursor-pointer transition-colors text-xs",
                    item.checked && "bg-primary/5 border-primary/30"
                  )}
                >
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={() => toggleItem(idx)}
                    className="h-3.5 w-3.5"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-foreground">{item.drawing_ref || "—"}</span>
                    <span className="text-muted-foreground ml-1">{item.mark_number}</span>
                    <span className="text-muted-foreground/60 ml-1">×{item.total_pieces || 0}</span>
                    {item.bar_code && <span className="text-muted-foreground/50 ml-1">{item.bar_code}</span>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        {!completed && (
          <Button
            onClick={handleSubmit}
            disabled={saving || (!photoFile && !signatureData)}
            className="w-full h-12 text-sm font-bold tracking-wider uppercase"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirm Delivery
          </Button>
        )}
      </div>
    </div>
  );
}
