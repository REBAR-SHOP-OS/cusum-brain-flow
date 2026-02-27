import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png";
import { format } from "date-fns";

interface PackingSlipItem {
  mark_number: string | null;
  drawing_ref?: string | null;
  bar_code: string;
  cut_length_mm: number;
  total_pieces: number;
  asa_shape_code?: string | null;
}

interface DeliveryPackingSlipProps {
  slipNumber: string;
  deliveryNumber: string;
  customerName: string;
  shipTo?: string;
  date: string;
  items: PackingSlipItem[];
  onClose: () => void;
  invoiceNumber?: string;
  invoiceDate?: string;
  scope?: string;
  deliveryDate?: string;
  siteAddress?: string;
}

export function DeliveryPackingSlip({
  slipNumber,
  deliveryNumber,
  customerName,
  shipTo,
  date,
  items,
  onClose,
  invoiceNumber,
  invoiceDate,
  scope,
  deliveryDate,
  siteAddress,
}: DeliveryPackingSlipProps) {
  const handlePrint = () => window.print();

  const totalQty = items.reduce((s, i) => s + i.total_pieces, 0);
  const displayShipTo = siteAddress || shipTo;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8">
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <Button size="sm" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Print / PDF
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="bg-white text-black w-[210mm] min-h-[297mm] p-10 shadow-2xl print:shadow-none print:p-8 print:w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <img src={brandLogo} alt="Rebar.Shop" className="w-12 h-12 rounded-full object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Rebar.Shop Inc</h1>
              <p className="text-xs text-gray-500">9 Cedar Ave, Thornhill L3T 3W1, Canada</p>
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900">Packing Slip</h2>
        </div>

        {/* Info grid - Row 1 */}
        <div className="grid grid-cols-4 gap-4 mb-2 p-4 bg-gray-50 rounded-t-lg text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Customer</p>
            <p className="font-semibold">{customerName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Ship To</p>
            <p className="font-semibold">{displayShipTo || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Delivery #</p>
            <p className="font-semibold">
              {invoiceNumber ? `${invoiceNumber} - ${deliveryNumber}` : deliveryNumber}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Delivery Date</p>
            <p className="font-semibold">
              {deliveryDate ? format(new Date(deliveryDate), "MMM d, yyyy") : format(new Date(date), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        {/* Info grid - Row 2 */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-b-lg text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Invoice #</p>
            <p className="font-semibold">{invoiceNumber || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Invoice Date</p>
            <p className="font-semibold">
              {invoiceDate ? format(new Date(invoiceDate), "MMM d, yyyy") : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Scope</p>
            <p className="font-semibold">{scope || "—"}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold w-24">DW#</th>
              <th className="text-left py-2 font-bold w-24">Mark</th>
              <th className="text-right py-2 pr-4 font-bold w-20">Quantity</th>
              <th className="text-left py-2 pl-4 font-bold w-20">Size</th>
              <th className="text-left py-2 font-bold w-20">Type</th>
              <th className="text-right py-2 font-bold w-28">Cut Length</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-3 text-gray-700">{item.drawing_ref || "—"}</td>
                <td className="py-3 text-gray-700">{item.mark_number || "—"}</td>
                <td className="py-3 pr-4 text-right tabular-nums font-medium">{item.total_pieces}</td>
                <td className="py-3 pl-4 text-gray-600">{item.bar_code}</td>
                <td className="py-3 text-gray-600">{item.asa_shape_code ? "Bent" : "Straight"}</td>
                <td className="py-3 text-right tabular-nums">{(item.cut_length_mm / 1000).toFixed(2)} m</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-900">
              <td colSpan={2} className="py-2 font-bold text-right">Total</td>
              <td className="py-2 text-right font-bold tabular-nums">{totalQty}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>

        {/* Signature area */}
        <div className="grid grid-cols-2 gap-8 mt-12">
          <div>
            <div className="border-b border-gray-400 h-16" />
            <p className="text-xs text-gray-500 mt-1">Delivered By (Signature)</p>
          </div>
          <div>
            <div className="border-b border-gray-400 h-16" />
            <p className="text-xs text-gray-500 mt-1">Received By (Signature)</p>
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
