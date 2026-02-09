import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png";

interface PackingSlipItem {
  date: string;
  description: string;
  quantity: string;
}

interface PackingSlipData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  shipTo?: string;
  salesRep?: string;
  items: PackingSlipItem[];
  inclusions?: string[];
}

interface Props {
  data: PackingSlipData;
  onClose: () => void;
}

export function PackingSlipTemplate({ data, onClose }: Props) {
  const handlePrint = () => window.print();

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

        {/* Info grid */}
        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Bill To</p>
            <p className="font-semibold">{data.customerName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Ship To</p>
            <p className="font-semibold">{data.shipTo || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Invoice Date</p>
            <p className="font-semibold">{data.invoiceDate}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Invoice Number</p>
            <p className="font-semibold">{data.invoiceNumber}</p>
          </div>
        </div>

        {data.salesRep && (
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-medium">Sales Rep:</span> {data.salesRep}
          </p>
        )}

        {/* Items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold w-28">Date</th>
              <th className="text-left py-2 font-bold">Description</th>
              <th className="text-right py-2 font-bold w-28">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-3 text-gray-600">{item.date}</td>
                <td className="py-3 pr-4 text-gray-700 text-xs leading-relaxed">{item.description}</td>
                <td className="py-3 text-right tabular-nums">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Inclusions */}
        {data.inclusions && data.inclusions.length > 0 && (
          <div className="mb-6">
            <p className="font-bold text-sm mb-2">Inclusion:</p>
            <ul className="text-xs text-gray-700 space-y-0.5">
              {data.inclusions.map((inc, idx) => (
                <li key={idx}>{inc}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-0.5">
          <p>☎ 6472609403 · ✉ accounting@rebar.shop · http://www.rebar.shop</p>
          <p>761487149RT0001</p>
        </div>
      </div>
    </div>
  );
}
