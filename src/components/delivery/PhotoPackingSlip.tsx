import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png";
import { format } from "date-fns";

interface PhotoPackingSlipItem {
  id: string;
  mark_number: string | null;
  bar_code: string;
  cut_length_mm: number;
  total_pieces: number;
  drawing_ref?: string | null;
  asa_shape_code?: string | null;
}

interface PhotoPackingSlipProps {
  slipNumber: string;
  customerName: string;
  date: string;
  items: PhotoPackingSlipItem[];
  photoUrls: Map<string, string>;
  onClose: () => void;
  scope?: string;
}

export function PhotoPackingSlip({
  slipNumber,
  customerName,
  date,
  items,
  photoUrls,
  onClose,
  scope,
}: PhotoPackingSlipProps) {
  const handlePrint = () => window.print();
  const totalQty = items.reduce((s, i) => s + i.total_pieces, 0);

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

        {/* Info row */}
        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Customer</p>
            <p className="font-semibold">{customerName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Slip #</p>
            <p className="font-semibold">{slipNumber}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Date</p>
            <p className="font-semibold">{format(new Date(date), "MMM d, yyyy")}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Scope</p>
            <p className="font-semibold">{scope || "—"}</p>
          </div>
        </div>

        {/* Items with photos */}
        <div className="space-y-3 mb-6">
          {items.map((item) => {
            const photoUrl = photoUrls.get(item.id);
            return (
              <div key={item.id} className="flex gap-4 border border-gray-200 rounded-lg p-3 break-inside-avoid">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={`Loading evidence for ${item.mark_number || item.bar_code}`}
                    className="w-24 h-24 rounded object-cover shrink-0 border border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded bg-gray-100 flex items-center justify-center shrink-0 text-[10px] text-gray-400">
                    No Photo
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-sm">{item.mark_number || "No mark"}</p>
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{item.bar_code}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="text-gray-400">Length: </span>
                      <span className="font-medium">{(item.cut_length_mm / 1000).toFixed(2)} m</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Qty: </span>
                      <span className="font-medium">{item.total_pieces}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Type: </span>
                      <span className="font-medium">{item.asa_shape_code ? "Bent" : "Straight"}</span>
                    </div>
                  </div>
                  {item.drawing_ref && (
                    <p className="text-xs text-gray-400 mt-1">DW# {item.drawing_ref}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="border-t-2 border-gray-900 pt-2 flex justify-between text-sm font-bold mb-8">
          <span>{items.length} Items</span>
          <span>Total Qty: {totalQty}</span>
        </div>

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
