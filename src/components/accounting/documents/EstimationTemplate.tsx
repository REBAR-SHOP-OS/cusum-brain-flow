import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png";

interface EstimationLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

interface EstimationSection {
  title: string;
  items: EstimationLineItem[];
}

interface EstimationData {
  estimateNumber: string;
  estimateDate: string;
  validUntil: string;
  customerName: string;
  customerAddress?: string;
  projectName: string;
  projectAddress?: string;
  sections: EstimationSection[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string[];
  assumptions?: string[];
}

interface Props {
  data: EstimationData;
  onClose: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function EstimationTemplate({ data, onClose }: Props) {
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
          <div className="text-right">
            <h2 className="text-2xl font-black text-gray-900">Estimation</h2>
            <p className="text-sm text-gray-900 font-semibold mt-1">#{data.estimateNumber}</p>
            <p className="text-sm text-gray-500">Date: {data.estimateDate}</p>
            <p className="text-sm text-gray-500">Valid Until: {data.validUntil}</p>
          </div>
        </div>

        {/* Project & Customer info */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Customer</p>
            <p className="text-base font-semibold">{data.customerName}</p>
            {data.customerAddress && <p className="text-sm text-gray-600">{data.customerAddress}</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Project</p>
            <p className="text-base font-semibold">{data.projectName}</p>
            {data.projectAddress && <p className="text-sm text-gray-600">{data.projectAddress}</p>}
          </div>
        </div>

        {/* Sections with items */}
        {data.sections.map((section, sIdx) => (
          <div key={sIdx} className="mb-6">
            <h3 className="font-bold text-sm uppercase tracking-wide text-gray-700 mb-2 pb-1 border-b border-gray-300">
              {section.title}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-400">
                  <th className="text-left py-1.5">Description</th>
                  <th className="text-right py-1.5 w-16">Qty</th>
                  <th className="text-right py-1.5 w-16">Unit</th>
                  <th className="text-right py-1.5 w-24">Rate</th>
                  <th className="text-right py-1.5 w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2 text-xs text-gray-700">{item.description}</td>
                    <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-500 text-xs">{item.unit}</td>
                    <td className="py-2 text-right tabular-nums">{fmt(item.unitPrice)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Notes & Assumptions */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {data.notes && data.notes.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-bold text-xs mb-1.5">Notes:</p>
              <ul className="text-xs text-gray-600 space-y-0.5 list-disc pl-3">
                {data.notes.map((n, idx) => <li key={idx}>{n}</li>)}
              </ul>
            </div>
          )}
          {data.assumptions && data.assumptions.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-bold text-xs mb-1.5">Assumptions:</p>
              <ul className="text-xs text-gray-600 space-y-0.5 list-disc pl-3">
                {data.assumptions.map((a, idx) => <li key={idx}>{a}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span className="tabular-nums">{fmt(data.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax {(data.taxRate * 100).toFixed(0)}%:</span>
              <span className="tabular-nums">{fmt(data.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t-2 border-gray-900 pt-2 mt-2">
              <span>Estimated Total:</span>
              <span className="tabular-nums">{fmt(data.total)}</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-[10px] text-yellow-800">
            <strong>DISCLAIMER:</strong> This is an estimate only. Final pricing may vary based on actual measurements, 
            site conditions, and material availability. This estimate is valid for 30 days from the date above.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-0.5">
          <p>☎ 6472609403 · ✉ accounting@rebar.shop · http://www.rebar.shop</p>
          <p>761487149RT0001</p>
        </div>
      </div>
    </div>
  );
}
