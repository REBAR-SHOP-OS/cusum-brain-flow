import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png";

interface PackingSlipItem {
  dwNumber?: string;
  mark?: string;
  quantity: number;
  size: string;
  type?: string;
  cutLength?: string;
}

interface PackingSlipData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  shipTo?: string;
  deliveryNumber?: string;
  deliveryDate?: string;
  scope?: string;
  items: PackingSlipItem[];
}

interface Props {
  data: PackingSlipData;
  onClose: () => void;
}

export function PackingSlipTemplate({ data, onClose }: Props) {
  const handlePrint = () => window.print();

  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);

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
            <p className="font-semibold">{data.customerName}</p>
          </div>
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Ship To</p>
            <p className="font-semibold">{data.shipTo || "—"}</p>
          </div>
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Delivery #</p>
            <p className="font-semibold">{data.deliveryNumber || "—"}</p>
          </div>
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Delivery Date</p>
            <p className="font-semibold">{data.deliveryDate || "—"}</p>
          </div>
        </div>

        {/* Info grid row 2 */}
        <div className="grid grid-cols-3 border border-t-0 border-gray-400 text-sm mb-6">
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Invoice #</p>
            <p className="font-semibold">{data.invoiceNumber}</p>
          </div>
          <div className="p-2 border-r border-gray-400">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Invoice Date</p>
            <p className="font-semibold">{data.invoiceDate}</p>
          </div>
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Scope</p>
            <p className="font-semibold">{data.scope || "—"}</p>
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
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 px-2 text-gray-600">{item.dwNumber || ""}</td>
                <td className="py-2 px-2 text-gray-700">{item.mark || ""}</td>
                <td className="py-2 pr-6 text-right font-bold tabular-nums">{item.quantity}</td>
                <td className="py-2 pl-6 text-gray-700">{item.size}</td>
                <td className="py-2 px-2 text-gray-700">{item.type || ""}</td>
                <td className="py-2 px-2 text-gray-700">{item.cutLength || ""}</td>
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
            <div className="border-b border-gray-400 mb-1 h-10"></div>
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
