import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Mail, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import brandLogo from "@/assets/brand-logo.png";

interface ChecklistItem {
  drawing_ref?: string;
  mark_number?: string;
  total_pieces?: number;
  bar_code?: string;
  cut_length_mm?: number;
  asa_shape_code?: string;
}

interface SlipMeta {
  slipNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  shipTo?: string;
  scope?: string;
  deliveryDate?: string;
}

interface Props {
  slipMeta: SlipMeta;
  customerName: string;
  siteAddress: string;
  items: ChecklistItem[];
  signatureData: string | null;
  onClose: () => void;
}

export function PackingSlipPreview({ slipMeta, customerName, siteAddress, items, signatureData, onClose }: Props) {
  const [sending, setSending] = useState(false);

  const totalQty = items.reduce((sum, it) => sum + (it.total_pieces || 0), 0);

  const formatCutLength = (mm?: number) => {
    if (!mm) return "";
    return `${(mm / 1000).toFixed(mm % 1000 === 0 ? 0 : 1)} m`;
  };

  const buildSlipHtml = () => {
    const sigHtml = signatureData
      ? `<img src="${signatureData}" style="max-height:60px;max-width:200px;" alt="Signature" />`
      : "";

    const rows = items.map(it => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:6px 8px;color:#4b5563;">${it.drawing_ref || ""}</td>
        <td style="padding:6px 8px;color:#374151;">${it.mark_number || ""}</td>
        <td style="padding:6px 24px 6px 8px;text-align:right;font-weight:700;">${it.total_pieces || 0}</td>
        <td style="padding:6px 8px 6px 24px;color:#374151;">${it.bar_code || ""}</td>
        <td style="padding:6px 8px;color:#374151;">${it.asa_shape_code || ""}</td>
        <td style="padding:6px 8px;color:#374151;">${formatCutLength(it.cut_length_mm)}</td>
      </tr>
    `).join("");

    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;">
        <h2 style="margin:0 0 16px;">Packing Slip — ${slipMeta.slipNumber || slipMeta.invoiceNumber || ""}</h2>
        <p><strong>Customer:</strong> ${customerName} · <strong>Ship To:</strong> ${slipMeta.shipTo || siteAddress || "—"}</p>
        <p><strong>Invoice #:</strong> ${slipMeta.invoiceNumber || "—"} · <strong>Date:</strong> ${slipMeta.invoiceDate || "—"} · <strong>Scope:</strong> ${slipMeta.scope || "—"}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
          <thead><tr style="border-bottom:2px solid #111;background:#f9fafb;">
            <th style="text-align:left;padding:6px 8px;">DW#</th>
            <th style="text-align:left;padding:6px 8px;">Mark</th>
            <th style="text-align:right;padding:6px 24px 6px 8px;">Qty</th>
            <th style="text-align:left;padding:6px 8px 6px 24px;">Size</th>
            <th style="text-align:left;padding:6px 8px;">Type</th>
            <th style="text-align:left;padding:6px 8px;">Cut Length</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="border-top:2px solid #111;">
            <td colspan="2" style="padding:6px 8px;font-weight:700;">Total</td>
            <td style="padding:6px 24px 6px 8px;text-align:right;font-weight:700;">${totalQty}</td>
            <td colspan="3"></td>
          </tr></tfoot>
        </table>
        <div style="margin-top:24px;">
          <p style="font-size:11px;color:#6b7280;">Received By (Signature):</p>
          ${sigHtml || '<div style="border-bottom:1px solid #9ca3af;height:40px;width:200px;"></div>'}
        </div>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
        <p style="font-size:10px;color:#9ca3af;text-align:center;">☎ 6472609403 · ✉ accounting@rebar.shop · www.rebar.shop</p>
      </div>
    `;
  };

  const handleEmail = async () => {
    const email = window.prompt("Enter recipient email address:");
    if (!email?.trim()) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: email.trim(),
          subject: `Packing Slip ${slipMeta.slipNumber || slipMeta.invoiceNumber || ""} — ${customerName}`,
          body: buildSlipHtml(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Packing slip sent to ${email.trim()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8">
      {/* Action bar */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <Button size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Print / PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={handleEmail} disabled={sending} className="gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Email
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Slip document */}
      <div className="bg-white text-black w-[210mm] min-h-[297mm] p-10 shadow-2xl print:shadow-none print:p-8 print:w-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <img src={brandLogo} alt="Rebar.Shop" className="w-12 h-12 rounded-full object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Rebar.Shop Inc</h1>
              <p className="text-xs text-gray-500">9 Cedar Ave, Thornhill L3T 3W1, Canada</p>
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900">Packing Slip</h2>
        </div>

        {/* Info grid row 1 */}
        <div className="grid grid-cols-4 border border-gray-400 text-sm mb-0">
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Customer</p>
            <p className="font-semibold">{customerName}</p>
          </div>
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Ship To</p>
            <p className="font-semibold">{slipMeta.shipTo || siteAddress || "—"}</p>
          </div>
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Delivery #</p>
            <p className="font-semibold">{slipMeta.slipNumber || "—"}</p>
          </div>
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Delivery Date</p>
            <p className="font-semibold">{slipMeta.deliveryDate || "—"}</p>
          </div>
        </div>

        {/* Info grid row 2 */}
        <div className="grid grid-cols-3 border border-t-0 border-gray-400 text-sm mb-6">
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Invoice #</p>
            <p className="font-semibold">{slipMeta.invoiceNumber || "—"}</p>
          </div>
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Invoice Date</p>
            <p className="font-semibold">{slipMeta.invoiceDate || "—"}</p>
          </div>
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Scope</p>
            <p className="font-semibold">{slipMeta.scope || "—"}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-6 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-900 bg-gray-50">
              <th className="text-left py-2 px-2 font-bold w-16">DW#</th>
              <th className="text-left py-2 px-2 font-bold w-20">Mark</th>
              <th className="text-right py-2 pr-6 font-bold w-20">Quantity</th>
              <th className="text-left py-2 pl-6 font-bold w-20">Size</th>
              <th className="text-left py-2 px-2 font-bold">Type</th>
              <th className="text-left py-2 px-2 font-bold w-28">Cut Length</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 px-2 text-gray-600">{item.drawing_ref || ""}</td>
                <td className="py-2 px-2 text-gray-700">{item.mark_number || ""}</td>
                <td className="py-2 pr-6 text-right font-bold tabular-nums">{item.total_pieces || 0}</td>
                <td className="py-2 pl-6 text-gray-700">{item.bar_code || ""}</td>
                <td className="py-2 px-2 text-gray-700">{item.asa_shape_code || ""}</td>
                <td className="py-2 px-2 text-gray-700">{formatCutLength(item.cut_length_mm)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-900">
              <td className="py-2 px-2" colSpan={2}>
                <span className="font-bold">Total</span>
              </td>
              <td className="py-2 pr-6 text-right font-bold tabular-nums">{totalQty}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>

        {/* Signature section */}
        <div className="grid grid-cols-2 gap-12 mt-8 mb-8">
          <div>
            <div className="border-b border-gray-400 mb-1 h-10"></div>
            <p className="text-xs text-gray-500">Delivered By (Signature)</p>
          </div>
          <div>
            {signatureData ? (
              <div className="mb-1 h-10 flex items-end">
                <img src={signatureData} alt="Customer signature" className="max-h-[40px] max-w-[200px] object-contain" />
              </div>
            ) : (
              <div className="border-b border-gray-400 mb-1 h-10"></div>
            )}
            <p className="text-xs text-gray-500">Received By (Signature)</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-0.5">
          <p>☎ 6472609403 · ✉ accounting@rebar.shop · http://www.rebar.shop</p>
          <p>761487149RT0001</p>
        </div>
      </div>
    </div>
  );
}
